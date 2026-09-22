import type { RoadSelection, TrafficSign } from '../../types/trafficSign';

export type TrafficSignPanelState =
  | {
      status: 'idle';
      road: null;
      signs: [];
      errorMessage?: undefined;
    }
  | {
      status: 'loading' | 'loaded' | 'error';
      road: RoadSelection;
      signs: TrafficSign[];
      errorMessage?: string;
    };

interface TrafficSignPanelProps {
  state: TrafficSignPanelState;
  onClose: () => void;
}

function formatDistance(distanceMeters: number) {
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`;
  }

  return `${Math.round(distanceMeters)} m`;
}

function getRoadTitle(road: RoadSelection) {
  return road.name || 'Đường chưa có tên';
}

function getUsefulTags(tags: Record<string, string>) {
  return Object.entries(tags).filter(([key]) =>
    [
      'traffic_sign',
      'traffic_sign:forward',
      'traffic_sign:backward',
      'direction',
      'highway',
      'crossing',
      'oneway',
      'junction',
      'maxspeed',
      'overtaking',
      'access',
      'vehicle',
      'motor_vehicle',
      'motorcycle',
      'motorcar',
      'hgv',
      'bus',
      'bicycle',
      'foot',
      'restriction',
      'name',
    ].includes(key) ||
    key.startsWith('parking:') ||
    key.startsWith('access:')
  );
}

export function TrafficSignPanel({ state, onClose }: TrafficSignPanelProps) {
  if (state.status === 'idle' || !state.road) {
    return null;
  }

  const { road, signs } = state;

  return (
    <aside className="traffic-sign-panel" aria-label="Traffic signs for selected road">
      <header>
        <div>
          <span className="section-kicker">BIỂN GIAO THÔNG</span>
          <h2>{getRoadTitle(road)}</h2>
        </div>
        <button type="button" aria-label="Đóng bảng biển giao thông" onClick={onClose}>
          ×
        </button>
      </header>

      <div className="traffic-road-meta">
        <span>Layer: {road.layerId}</span>
        {road.className && <span>Loại: {road.className}</span>}
      </div>

      {state.status === 'loading' && (
        <div className="traffic-sign-empty">Đang tải dữ liệu biển giao thông...</div>
      )}

      {state.status === 'error' && (
        <div className="traffic-sign-error">
          <strong>Không tải được dữ liệu biển</strong>
          <span>{state.errorMessage}</span>
        </div>
      )}

      {state.status === 'loaded' && signs.length === 0 && (
        <div className="traffic-sign-empty">
          Chưa có dữ liệu biển giao thông trong OSM quanh điểm bấm trên đường này.
        </div>
      )}

      {state.status === 'loaded' && signs.length > 0 && (
        <div className="traffic-sign-list">
          {signs.map((sign) => {
            const usefulTags = getUsefulTags(sign.tags);

            return (
              <article key={sign.id} className="traffic-sign-item">
                <div>
                  <strong>{sign.label}</strong>
                  <span>
                    {sign.source === 'road-rule' ? 'Quy định trên đường' : 'Biển được map'} ·{' '}
                    {formatDistance(sign.distanceMeters)} từ điểm bấm
                  </span>
                </div>
                {sign.value && <p>{sign.value}</p>}
                {usefulTags.length > 0 && (
                  <dl>
                    {usefulTags.map(([key, value]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </article>
            );
          })}
        </div>
      )}
    </aside>
  );
}
