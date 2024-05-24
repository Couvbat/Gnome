const fs = require("fs");
const path = require("path");
const { SlashCommandBuilder } = require("discord.js");
const { request } = require("undici");

module.exports = {
  cooldown: "10", // seconds
  data: new SlashCommandBuilder()
    .setName("imagine")
    .setDescription("Générez une image avec stable diffusion")
    .addStringOption((option) =>
      option.setName("prompt").setDescription("Prompt").setRequired(true)
    )
    .addStringOption((option) =>
      option.setName("negative_prompt").setDescription("Prompt négatif")
    ),

  async execute(interaction) {
    const prompt = interaction.options.getString("prompt");
    let negativePrompt = interaction.options.getString("negativePrompt");



    const apiRequest = await request("http://127.0.0.1:7860/sdapi/v1/txt2img", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      timeout: 30000,
      body: JSON.stringify({
        prompt: `${prompt}`,
        negative_prompt: `${negativePrompt}`,
        steps: 30,
        seed: -1,
        sampler_name: "Euler a",
        cfg_scale: 8,
        width: 512,
        height: 768,
        enable_hr: true,
        tiling: false,
        hr_prompt: `${prompt}`,
        hr_negative_prompt: `${negativePrompt}`,
        denoising_strength: 0.3,
        // hr_scale: 2,
        hr_resize_size_x: 1024,
        hr_resize_size_y: 1536,
        hr_upscaler: "4x-AnimeSharp",
        hr_sampler_name: "Euler a",
        hr_second_pass_steps: 10,
      }),
    });

    // Parse the response body as JSON
    const body = await apiRequest.body.json();

    // Extract the first base64 image string
    const imageB64 = body.images[0];

    // Decode Base64 string to a Buffer
    const imageBuffer = Buffer.from(imageB64, "base64");

    // Define the image path
    const imagePath = path.join(__dirname, "image.jpg");

    // Write the image data to a file
    fs.writeFileSync(imagePath, imageBuffer);

    // Reply to the interaction with the bot
    await interaction.followUp({ files: [imagePath] });

    // Delete the image file after sending it
    fs.unlinkSync(imagePath);
  },
};
