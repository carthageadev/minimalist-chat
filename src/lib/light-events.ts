import React from "react";

// Light control event types
export type LightAction =
  | "toggleYellowLight"
  | "toggleRedLights"
  | "toggleBulbLight"
  | "turnOnYellowLight"
  | "turnOffYellowLight"
  | "turnOnRedLights"
  | "turnOffRedLights"
  | "turnOnBulbLight"
  | "turnOffBulbLight"
  | "turnOnAllLights"
  | "turnOffAllLights"
  | "setYellowLightIntensity"
  | "setRedLightsIntensity"
  | "setBulbLightIntensity"
  | "setAllLightsIntensity";

export interface LightEvent {
  action: LightAction;
  intensity?: number;
  lightId?: number; // For individual red lights
}

export interface LightEventCallbacks {
  onToggleYellowLight?: () => void;
  onToggleRedLights?: () => void;
  onToggleBulbLight?: () => void;
  onTurnOnYellowLight?: () => void;
  onTurnOffYellowLight?: () => void;
  onTurnOnRedLights?: () => void;
  onTurnOffRedLights?: () => void;
  onTurnOnBulbLight?: () => void;
  onTurnOffBulbLight?: () => void;
  onTurnOnAllLights?: () => void;
  onTurnOffAllLights?: () => void;
  onSetYellowLightIntensity?: (intensity: number) => void;
  onSetRedLightsIntensity?: (intensity: number) => void;
  onSetBulbLightIntensity?: (intensity: number) => void;
  onSetAllLightsIntensity?: (intensity: number) => void;
}

// Event listeners storage
const listeners: LightEventCallbacks[] = [];

// Event dispatcher
export function dispatchLightEvent(event: LightEvent) {
  listeners.forEach((callback) => {
    switch (event.action) {
      case "toggleYellowLight":
        callback.onToggleYellowLight?.();
        break;
      case "toggleRedLights":
        callback.onToggleRedLights?.();
        break;
      case "toggleBulbLight":
        callback.onToggleBulbLight?.();
        break;
      case "turnOnYellowLight":
        callback.onTurnOnYellowLight?.();
        break;
      case "turnOffYellowLight":
        callback.onTurnOffYellowLight?.();
        break;
      case "turnOnRedLights":
        callback.onTurnOnRedLights?.();
        break;
      case "turnOffRedLights":
        callback.onTurnOffRedLights?.();
        break;
      case "turnOnBulbLight":
        callback.onTurnOnBulbLight?.();
        break;
      case "turnOffBulbLight":
        callback.onTurnOffBulbLight?.();
        break;
      case "turnOnAllLights":
        callback.onTurnOnAllLights?.();
        break;
      case "turnOffAllLights":
        callback.onTurnOffAllLights?.();
        break;
      case "setYellowLightIntensity":
        if (event.intensity !== undefined) {
          callback.onSetYellowLightIntensity?.(event.intensity);
        }
        break;
      case "setRedLightsIntensity":
        if (event.intensity !== undefined) {
          callback.onSetRedLightsIntensity?.(event.intensity);
        }
        break;
      case "setBulbLightIntensity":
        if (event.intensity !== undefined) {
          callback.onSetBulbLightIntensity?.(event.intensity);
        }
        break;
      case "setAllLightsIntensity":
        if (event.intensity !== undefined) {
          callback.onSetAllLightsIntensity?.(event.intensity);
        }
        break;
    }
  });
}

// Hook for listening to light events
export function useLightEvents(callbacks: LightEventCallbacks) {
  React.useEffect(() => {
    listeners.push(callbacks);

    return () => {
      const index = listeners.indexOf(callbacks);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    };
  }, [callbacks]);
}
