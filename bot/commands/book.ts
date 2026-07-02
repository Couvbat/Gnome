import { SlashCommandBuilder, CommandInteraction, EmbedBuilder, AutocompleteInteraction } from 'discord.js';
import { request } from 'undici';
import { Command } from '../types/command';

// Popular book themes for autocomplete
const BOOK_THEMES = [
  'science-fiction',
  'fantasy',
  'mystery',
  'romance',
  'thriller',
  'horror',
  'adventure',
  'biography',
  'history',
  'philosophy',
  'psychology',
  'self-help',
  'business',
  'cooking',
  'art',
  'poetry',
  'drama',
  'comedy',
  'crime',
  'detective',
  'dystopian',
  'historical-fiction',
  'magic',
  'mythology',
  'paranormal',
  'politics',
  'religion',
  'sports',
  'technology',
  'travel',
  'true-crime',
  'war',
  'western',
  'young-adult'
];

interface BookResult {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
  publisher?: string[];
  isbn?: string[];
  subject?: string[];
  edition_count?: number;
}

interface SubjectResponse {
  key: string;
  name: string;
  subject_type: string;
  work_count: number;
  works: {
    key: string;
    title: string;
    authors: Array<{ name: string; key: string }>;
    first_publish_year?: number;
    cover_id?: number;
    edition_count?: number;
  }[];
}

interface SearchResponse {
  numFound: number;
  docs: BookResult[];
}

export const command: Command = {
  data: new SlashCommandBuilder()
    .setName('book')
    .setDescription('Obtenir une recommandation de livre avec filtre par thème')
    .addStringOption(option =>
      option
        .setName('theme')
        .setDescription('Thème ou sujet du livre (ex: science-fiction, fantasy, mystery)')
        .setRequired(true)
        .setAutocomplete(true)
    )
    .addIntegerOption(option =>
      option
        .setName('count')
        .setDescription('Nombre de recommandations (1-5)')
        .setMinValue(1)
        .setMaxValue(5)
    ),

  async autocomplete(interaction: AutocompleteInteraction): Promise<void> {
    const focusedValue = interaction.options.getFocused().toLowerCase();
    
    // Filter themes based on user input
    const filtered = BOOK_THEMES.filter(theme => 
      theme.toLowerCase().includes(focusedValue)
    );
    
    // Discord autocomplete is limited to 25 choices
    const choices = filtered.slice(0, 25).map(theme => ({
      name: theme,
      value: theme
    }));

    await interaction.respond(choices);
  },

  async execute(interaction: CommandInteraction): Promise<void> {
    if (!interaction.isChatInputCommand()) return;

    await interaction.deferReply();

    const theme = interaction.options.getString('theme', true);
    const count = interaction.options.getInteger('count') || 1;

    try {
      // Clean and format the theme for the API
      const formattedTheme = theme.toLowerCase().trim().replace(/\s+/g, '_');

      // First try the Subjects API for theme-based recommendations
      const subjectUrl = `https://openlibrary.org/subjects/${formattedTheme}.json?limit=${count * 2}`;
      
      const response = await request(subjectUrl, {
        headers: {
          'User-Agent': 'LeGnomeDiscordBot/1.0 (Discord bot for book recommendations)',
          'Accept': 'application/json'
        }
      });

      if (response.statusCode === 404) {
        // If subject not found, try a broader search
        const searchUrl = `https://openlibrary.org/search.json?subject=${encodeURIComponent(theme)}&limit=${count * 2}`;
        const searchResponse = await request(searchUrl, {
          headers: {
            'User-Agent': 'LeGnomeDiscordBot/1.0 (Discord bot for book recommendations)',
            'Accept': 'application/json'
          }
        });

        const searchData = await searchResponse.body.json() as SearchResponse;

        if (!searchData.docs || searchData.docs.length === 0) {
          await interaction.editReply(`Aucun livre trouvé pour le thème "${theme}". Essayez un autre thème comme "science fiction", "fantasy", "mystery", ou "romance".`);
          return;
        }

        // Select random books from search results
        const selectedBooks = getRandomBooks(searchData.docs, count);
        await sendBookRecommendations(interaction, selectedBooks, theme, 'search');
        return;
      }

      const data = await response.body.json() as SubjectResponse;

      if (!data.works || data.works.length === 0) {
        await interaction.editReply(`Aucun livre trouvé pour le thème "${theme}". Essayez un autre thème.`);
        return;
      }

      // Select random works from the subject results
      const selectedWorks = getRandomBooks(data.works, count);
      await sendBookRecommendations(interaction, selectedWorks, theme, 'subject');

    } catch (error) {
      console.error('Error fetching book recommendations:', error);
      await interaction.editReply('Une erreur est survenue lors de la recherche de recommandations. Réessayez plus tard.');
    }
  },

  cooldown: 5
};

/**
 * Get random books from an array
 */
function getRandomBooks<T>(books: T[], count: number): T[] {
  const shuffled = [...books].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, books.length));
}

/**
 * Send book recommendations as embeds
 */
async function sendBookRecommendations(
  interaction: CommandInteraction,
  books: any[],
  theme: string,
  source: 'search' | 'subject'
): Promise<void> {
  const embeds: EmbedBuilder[] = [];

  for (const book of books) {
    const embed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTimestamp();

    if (source === 'subject') {
      // Format for Subject API response
      const title = book.title || 'Titre inconnu';
      const authors = book.authors?.map((a: any) => a.name).join(', ') || 'Auteur inconnu';
      const year = book.first_publish_year || 'N/A';
      const editions = book.edition_count || 'N/A';
      const workKey = book.key;
      const coverUrl = book.cover_id 
        ? `https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`
        : null;

      embed
        .setTitle(title)
        .setURL(`https://openlibrary.org${workKey}`)
        .addFields(
          { name: '📚 Auteur(s)', value: authors, inline: true },
          { name: '📅 Première publication', value: year.toString(), inline: true },
          { name: '📖 Éditions', value: editions.toString(), inline: true }
        );

      if (coverUrl) {
        embed.setThumbnail(coverUrl);
      }
    } else {
      // Format for Search API response
      const title = book.title || 'Titre inconnu';
      const authors = book.author_name?.join(', ') || 'Auteur inconnu';
      const year = book.first_publish_year || 'N/A';
      const editions = book.edition_count || 'N/A';
      const workKey = book.key;
      const coverUrl = book.cover_i 
        ? `https://covers.openlibrary.org/b/id/${book.cover_i}-L.jpg`
        : null;

      embed
        .setTitle(title)
        .setURL(`https://openlibrary.org${workKey}`)
        .addFields(
          { name: '📚 Auteur(s)', value: authors, inline: true },
          { name: '📅 Première publication', value: year.toString(), inline: true },
          { name: '📖 Éditions', value: editions.toString(), inline: true }
        );

      if (coverUrl) {
        embed.setThumbnail(coverUrl);
      }

      // Add subjects if available (limited to first 5)
      if (book.subject && book.subject.length > 0) {
        const subjects = book.subject.slice(0, 5).join(', ');
        embed.addFields({ name: '🏷️ Sujets', value: subjects });
      }
    }

    embeds.push(embed);
  }

  // Add header message
  const header = books.length === 1
    ? `📖 Voici une recommandation pour le thème **${theme}** :`
    : `📖 Voici ${books.length} recommandations pour le thème **${theme}** :`;

  await interaction.editReply({ content: header, embeds });
}

// For backward compatibility with CommonJS require()
module.exports = { command };
