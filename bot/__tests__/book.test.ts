import { describe, test, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { command } from '../commands/book';
import { request } from 'undici';

vi.mock('undici');

describe('/book command', () => {
  let mockInteraction;

  beforeEach(() => {
    mockInteraction = {
      isChatInputCommand: vi.fn().mockReturnValue(true),
      options: {
        getString: vi.fn(),
        getInteger: vi.fn()
      },
      deferReply: vi.fn().mockResolvedValue(undefined),
      editReply: vi.fn().mockResolvedValue(undefined),
      user: { username: 'TestUser' }
    };

    vi.clearAllMocks();
  });

  describe('Subject API success', () => {
    it('should return a single book recommendation for a valid theme', async () => {
      mockInteraction.options.getString.mockReturnValue('fantasy');
      mockInteraction.options.getInteger.mockReturnValue(null);

      const mockSubjectResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            key: '/subjects/fantasy',
            name: 'Fantasy',
            works: [
              {
                key: '/works/OL123W',
                title: 'The Lord of the Rings',
                authors: [{ name: 'J.R.R. Tolkien', key: '/authors/OL456A' }],
                first_publish_year: 1954,
                cover_id: 12345,
                edition_count: 150
              }
            ]
          })
        }
      };

      request.mockResolvedValue(mockSubjectResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.deferReply).toHaveBeenCalled();
      expect(request).toHaveBeenCalledWith(
        expect.stringContaining('openlibrary.org/subjects/fantasy.json'),
        expect.objectContaining({
          headers: expect.objectContaining({
            'User-Agent': expect.any(String),
            'Accept': 'application/json'
          })
        })
      );
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('fantasy'),
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'The Lord of the Rings'
              })
            })
          ])
        })
      );
    });

    it('should return multiple book recommendations when count is specified', async () => {
      mockInteraction.options.getString.mockReturnValue('science_fiction');
      mockInteraction.options.getInteger.mockReturnValue(3);

      const mockSubjectResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            key: '/subjects/science_fiction',
            name: 'Science Fiction',
            works: [
              {
                key: '/works/OL123W',
                title: 'Dune',
                authors: [{ name: 'Frank Herbert', key: '/authors/OL1A' }],
                first_publish_year: 1965,
                cover_id: 111,
                edition_count: 200
              },
              {
                key: '/works/OL456W',
                title: 'Foundation',
                authors: [{ name: 'Isaac Asimov', key: '/authors/OL2A' }],
                first_publish_year: 1951,
                cover_id: 222,
                edition_count: 100
              },
              {
                key: '/works/OL789W',
                title: 'Neuromancer',
                authors: [{ name: 'William Gibson', key: '/authors/OL3A' }],
                first_publish_year: 1984,
                cover_id: 333,
                edition_count: 75
              }
            ]
          })
        }
      };

      request.mockResolvedValue(mockSubjectResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.stringContaining('3 recommandations'),
          embeds: expect.any(Array)
        })
      );
    });
  });

  describe('Fallback to Search API', () => {
    it('should use search API when subject is not found', async () => {
      mockInteraction.options.getString.mockReturnValue('obscure theme');
      mockInteraction.options.getInteger.mockReturnValue(null);

      // First call (Subject API) returns 404
      const mockSubjectResponse = {
        statusCode: 404,
        body: {
          json: vi.fn().mockResolvedValue({})
        }
      };

      // Second call (Search API) returns results
      const mockSearchResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            numFound: 1,
            docs: [
              {
                key: '/works/OL999W',
                title: 'Obscure Book',
                author_name: ['Unknown Author'],
                first_publish_year: 2000,
                cover_i: 999,
                edition_count: 5,
                subject: ['obscure', 'rare']
              }
            ]
          })
        }
      };

      request
        .mockResolvedValueOnce(mockSubjectResponse)
        .mockResolvedValueOnce(mockSearchResponse);

      await command.execute(mockInteraction);

      expect(request).toHaveBeenCalledTimes(2);
      expect(request).toHaveBeenNthCalledWith(
        2,
        expect.stringContaining('openlibrary.org/search.json'),
        expect.any(Object)
      );
      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'Obscure Book'
              })
            })
          ])
        })
      );
    });

    it('should handle when no books are found in search', async () => {
      mockInteraction.options.getString.mockReturnValue('nonexistent');
      mockInteraction.options.getInteger.mockReturnValue(null);

      const mockSubjectResponse = {
        statusCode: 404,
        body: { json: vi.fn().mockResolvedValue({}) }
      };

      const mockSearchResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            numFound: 0,
            docs: []
          })
        }
      };

      request
        .mockResolvedValueOnce(mockSubjectResponse)
        .mockResolvedValueOnce(mockSearchResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Aucun livre trouvé')
      );
    });
  });

  describe('Error handling', () => {
    it('should handle API errors gracefully', async () => {
      mockInteraction.options.getString.mockReturnValue('fantasy');
      mockInteraction.options.getInteger.mockReturnValue(null);

      request.mockRejectedValue(new Error('Network error'));

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('erreur')
      );
    });

    it('should handle empty works array', async () => {
      mockInteraction.options.getString.mockReturnValue('empty');
      mockInteraction.options.getInteger.mockReturnValue(null);

      const mockSubjectResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            key: '/subjects/empty',
            name: 'Empty',
            works: []
          })
        }
      };

      request.mockResolvedValue(mockSubjectResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.stringContaining('Aucun livre trouvé')
      );
    });
  });

  describe('Book formatting', () => {
    it('should properly format books with all fields', async () => {
      mockInteraction.options.getString.mockReturnValue('test');
      mockInteraction.options.getInteger.mockReturnValue(null);

      const mockSubjectResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            works: [
              {
                key: '/works/OL1W',
                title: 'Complete Book',
                authors: [
                  { name: 'Author One', key: '/authors/OL1A' },
                  { name: 'Author Two', key: '/authors/OL2A' }
                ],
                first_publish_year: 2020,
                cover_id: 12345,
                edition_count: 10
              }
            ]
          })
        }
      };

      request.mockResolvedValue(mockSubjectResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'Complete Book',
                url: 'https://openlibrary.org/works/OL1W',
                thumbnail: expect.objectContaining({
                  url: expect.stringContaining('covers.openlibrary.org')
                }),
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    name: '📚 Auteur(s)',
                    value: 'Author One, Author Two'
                  }),
                  expect.objectContaining({
                    name: '📅 Première publication',
                    value: '2020'
                  }),
                  expect.objectContaining({
                    name: '📖 Éditions',
                    value: '10'
                  })
                ])
              })
            })
          ])
        })
      );
    });

    it('should handle books with missing optional fields', async () => {
      mockInteraction.options.getString.mockReturnValue('test');
      mockInteraction.options.getInteger.mockReturnValue(null);

      const mockSubjectResponse = {
        statusCode: 200,
        body: {
          json: vi.fn().mockResolvedValue({
            works: [
              {
                key: '/works/OL1W',
                title: 'Minimal Book',
                authors: [],
                // Missing first_publish_year, cover_id, edition_count
              }
            ]
          })
        }
      };

      request.mockResolvedValue(mockSubjectResponse);

      await command.execute(mockInteraction);

      expect(mockInteraction.editReply).toHaveBeenCalledWith(
        expect.objectContaining({
          embeds: expect.arrayContaining([
            expect.objectContaining({
              data: expect.objectContaining({
                title: 'Minimal Book',
                fields: expect.arrayContaining([
                  expect.objectContaining({
                    name: '📚 Auteur(s)',
                    value: 'Auteur inconnu'
                  }),
                  expect.objectContaining({
                    name: '📅 Première publication',
                    value: 'N/A'
                  })
                ])
              })
            })
          ])
        })
      );
    });
  });

  describe('Command metadata', () => {
    it('should have correct command name and description', () => {
      expect(command.data.name).toBe('book');
      expect(command.data.description).toBeDefined();
    });

    it('should have a cooldown', () => {
      expect(command.cooldown).toBe(5);
    });

    it('should have required theme option', () => {
      const options = command.data.options;
      const themeOption = options.find(opt => opt.name === 'theme');
      expect(themeOption).toBeDefined();
      expect(themeOption.required).toBe(true);
    });

    it('should have optional count option with min/max values', () => {
      const options = command.data.options;
      const countOption = options.find(opt => opt.name === 'count');
      expect(countOption).toBeDefined();
      expect(countOption.required).toBeFalsy();
      expect(countOption.min_value).toBe(1);
      expect(countOption.max_value).toBe(5);
    });
  });
});
