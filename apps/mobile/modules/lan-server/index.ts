import { requireOptionalNativeModule, EventSubscription } from 'expo-modules-core';

export interface LanServerStartResult {
  ip: string;
  ips: string[];
  port: number;
  wsUrl: string;
}

export interface DiscoveredLanRoom {
  roomCode: string;
  ip: string;
  port: number;
  wsUrl: string;
  hostName: string;
}

export interface LanClientConnectedEvent {
  clientId: string;
}

export interface LanClientDisconnectedEvent {
  clientId: string;
}

export interface LanMessageEvent {
  clientId: string;
  message: string;
}

export interface LanRoomsDiscoveredEvent {
  rooms: DiscoveredLanRoom[];
}

interface NativeLanServerModule {
  startServer(
    port: number,
    roomCode?: string,
    hostName?: string
  ): Promise<LanServerStartResult>;
  stopServer(): void;
  sendToClient(clientId: string, message: string): void;
  broadcast(message: string): void;
  getLocalIps(): string[];
  startDiscovery(): void;
  stopDiscovery(): void;
  addListener(
    eventName: 'onClientConnected',
    listener: (event: LanClientConnectedEvent) => void
  ): EventSubscription;
  addListener(
    eventName: 'onClientDisconnected',
    listener: (event: LanClientDisconnectedEvent) => void
  ): EventSubscription;
  addListener(
    eventName: 'onMessage',
    listener: (event: LanMessageEvent) => void
  ): EventSubscription;
  addListener(
    eventName: 'onRoomsDiscovered',
    listener: (event: LanRoomsDiscoveredEvent) => void
  ): EventSubscription;
}

const NativeLanServer =
  requireOptionalNativeModule<NativeLanServerModule>('LanServer');

export function isEmbeddedLanServerAvailable(): boolean {
  return NativeLanServer !== null;
}

export function getLanServerNativeModule(): NativeLanServerModule | null {
  return NativeLanServer;
}
