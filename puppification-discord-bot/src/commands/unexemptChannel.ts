import {
  ChannelType,
  MessageFlags,
  PermissionFlagsBits,
  SlashCommandBuilder,
  type ChatInputCommandInteraction,
} from 'discord.js';
import type { ChannelExemptionStore } from '../state/channelExemptions.js';
import type { SlashCommand } from './types.js';

const ALLOWED_CHANNEL_TYPES = [
  ChannelType.GuildText,
  ChannelType.GuildAnnouncement,
  ChannelType.GuildVoice,
  ChannelType.GuildStageVoice,
  ChannelType.GuildForum,
  ChannelType.PublicThread,
  ChannelType.PrivateThread,
  ChannelType.AnnouncementThread,
] as const;

export function createUnexemptChannelCommand(
  exemptions: ChannelExemptionStore,
): SlashCommand {
  const data = new SlashCommandBuilder()
    .setName('unexempt-channel')
    .setDescription(
      'Re-enable puppification in a channel that was previously exempted.',
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .setDMPermission(false)
    .addChannelOption((opt) =>
      opt
        .setName('channel')
        .setDescription(
          'The channel to unexempt. Defaults to the channel the command is run in.',
        )
        .addChannelTypes(...ALLOWED_CHANNEL_TYPES)
        .setRequired(false),
    );

  return {
    name: 'unexempt-channel',
    data: data.toJSON(),
    handle: async (interaction) => handle(interaction, exemptions),
  };
}

async function handle(
  interaction: ChatInputCommandInteraction,
  exemptions: ChannelExemptionStore,
): Promise<void> {
  if (!interaction.inGuild() || !interaction.guildId) {
    await interaction.reply({
      content: 'This command can only be used in a server.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const target =
    interaction.options.getChannel('channel', false) ?? interaction.channel;
  if (!target) {
    await interaction.reply({
      content: 'Could not resolve the target channel.',
      flags: MessageFlags.Ephemeral,
    });
    return;
  }

  const removed = exemptions.unexempt(interaction.guildId, target.id);
  if (!removed) {
    await interaction.reply({
      content: `<#${target.id}> wasn't exempt.`,
      allowedMentions: { parse: [] },
    });
    return;
  }

  await interaction.reply({
    content: `🐶 <#${target.id}> is no longer exempt; messages here will be puppified again.`,
    allowedMentions: { parse: [] },
  });
}
