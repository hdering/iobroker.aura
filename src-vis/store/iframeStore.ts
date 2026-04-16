import { create } from 'zustand';

export interface IframeFullscreenData {
  url: string;
  sandboxAttr?: string;
  iframeKey: string;
  title: string;
}

interface IframeStore {
  fullscreen: IframeFullscreenData | null;
  setFullscreen: (data: IframeFullscreenData | null) => void;
}

export const useIframeStore = create<IframeStore>()((set) => ({
  fullscreen: null,
  setFullscreen: (data) => set({ fullscreen: data }),
}));
