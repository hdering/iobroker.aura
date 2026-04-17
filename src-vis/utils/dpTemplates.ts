import type { WidgetType } from '../types';

export interface DpTemplate {
  id: string;
  label: string;
  widgetType: WidgetType;
  /** Sibling DP name patterns to try auto-filling (in order of preference) */
  secondaryDps: {
    optionKey: string;
    siblingNames: string[];
  }[];
}

export const DP_TEMPLATES: DpTemplate[] = [
  {
    id: 'shutter',
    label: 'Rollladen',
    widgetType: 'shutter',
    secondaryDps: [
      { optionKey: 'activityDp',  siblingNames: ['WORKING', 'working', 'moving', 'activity'] },
      { optionKey: 'directionDp', siblingNames: ['DIRECTION', 'direction'] },
    ],
  },
  {
    id: 'thermostat',
    label: 'Thermostat',
    widgetType: 'thermostat',
    secondaryDps: [
      { optionKey: 'actualDatapoint', siblingNames: ['ACTUAL', 'actual', 'TEMPERATURE', 'temperature', 'TEMP', 'temp'] },
    ],
  },
  {
    id: 'dimmer',
    label: 'Dimmer',
    widgetType: 'dimmer',
    secondaryDps: [],
  },
  {
    id: 'switch_light',
    label: 'Lichtschalter',
    widgetType: 'switch',
    secondaryDps: [],
  },
  {
    id: 'switch',
    label: 'Schalter',
    widgetType: 'switch',
    secondaryDps: [],
  },
  {
    id: 'value',
    label: 'Messwert',
    widgetType: 'value',
    secondaryDps: [],
  },
];
