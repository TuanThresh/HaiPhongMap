import { SPAWN_ZONES, type MapBounds } from '../../config/mapConfig';
import type { GameSettings } from '../../types/game';

interface GameSettingsPanelProps {
  settings: GameSettings;
  activeBounds: MapBounds;
  isBusy: boolean;
  isDrawingCustomZone: boolean;
  onSettingsChange: (settings: Partial<GameSettings>) => void;
  onToggleCustomZoneDraw: () => void;
}

function formatBounds(bounds: MapBounds) {
  return `${bounds.south.toFixed(4)}, ${bounds.west.toFixed(4)} → ${bounds.north.toFixed(4)}, ${bounds.east.toFixed(4)}`;
}

export function GameSettingsPanel({
  settings,
  activeBounds,
  isBusy,
  isDrawingCustomZone,
  onSettingsChange,
  onToggleCustomZoneDraw,
}: GameSettingsPanelProps) {
  return (
    <section className="settings-panel" aria-label="Game settings">
      <label>
        <span>Vùng chọn địa chỉ cố định</span>
        <select
          value={settings.spawnZoneId}
          onChange={(event) =>
            onSettingsChange({
              spawnZoneId: event.target.value as GameSettings['spawnZoneId'],
            })
          }
          disabled={isBusy || isDrawingCustomZone}
        >
          {SPAWN_ZONES.map((zone) => (
            <option key={zone.id} value={zone.id}>
              {zone.label}
            </option>
          ))}
          <option value="custom" disabled={!settings.customBounds}>
            Vùng tự chọn bằng kéo chuột
          </option>
        </select>
      </label>

      <button
        type="button"
        className={`draw-zone-action ${isDrawingCustomZone ? 'active' : ''}`}
        onClick={onToggleCustomZoneDraw}
        disabled={isBusy}
      >
        {isDrawingCustomZone ? 'Đang kéo vùng trên map...' : 'Kéo chuột chọn vùng custom'}
      </button>

      <div className="active-bounds-readout">
        <span>Bounds đang dùng</span>
        <strong>{formatBounds(activeBounds)}</strong>
      </div>

      <label className="guidance-toggle">
        <input
          type="checkbox"
          checked={settings.showRouteGuidance}
          onChange={(event) =>
            onSettingsChange({
              showRouteGuidance: event.target.checked,
            })
          }
        />
        <span>Hiện chỉ dẫn đường đi</span>
      </label>

      <label className="guidance-toggle">
        <input
          type="checkbox"
          checked={settings.showOneWayRoads}
          onChange={(event) =>
            onSettingsChange({
              showOneWayRoads: event.target.checked,
            })
          }
        />
        <span>Hiện đường 1 chiều</span>
      </label>

      <div className="distance-limit-grid">
        <label>
          <span>Min road distance</span>
          <input
            type="number"
            min="50"
            step="50"
            value={settings.minDistanceMeters}
            onChange={(event) =>
              onSettingsChange({
                minDistanceMeters: Number(event.target.value),
              })
            }
            disabled={isBusy}
          />
        </label>

        <label>
          <span>Max road distance</span>
          <input
            type="number"
            min="150"
            step="100"
            value={settings.maxDistanceMeters}
            onChange={(event) =>
              onSettingsChange({
                maxDistanceMeters: Number(event.target.value),
              })
            }
            disabled={isBusy}
          />
        </label>
      </div>
    </section>
  );
}
