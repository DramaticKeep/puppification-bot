import type { ChannelExemptionStore } from '../state/channelExemptions.js';
import type { PuppificationStore } from '../state/puppificationStore.js';
import { createExemptChannelCommand } from './exemptChannel.js';
import { createPuppifyCommand } from './puppify.js';
import type { SlashCommand } from './types.js';
import { createUnexemptChannelCommand } from './unexemptChannel.js';
import { createUnpuppifyCommand } from './unpuppify.js';

export type { SlashCommand } from './types.js';

export interface CommandStores {
  store: PuppificationStore;
  exemptions: ChannelExemptionStore;
}

export function buildCommands(stores: CommandStores): SlashCommand[] {
  return [
    createPuppifyCommand(stores.store),
    createUnpuppifyCommand(stores.store),
    createExemptChannelCommand(stores.exemptions),
    createUnexemptChannelCommand(stores.exemptions),
  ];
}

export function buildCommandMap(
  commands: SlashCommand[],
): Map<string, SlashCommand> {
  const map = new Map<string, SlashCommand>();
  for (const cmd of commands) {
    map.set(cmd.name, cmd);
  }
  return map;
}
