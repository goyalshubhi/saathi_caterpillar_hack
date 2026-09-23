// Today's hourly conditions: temperature, rain and wind, hot hours in amber, current hour marked.
import { CloudRain, Sun, Wind } from 'lucide-react';

const HOT = 35;
const WINDY = 25;

export default function ConditionsStrip({ weather, nowHour = new Date().getHours(), compact = false }) {
  if (!weather?.length) return null;
  const hours = compact ? weather.filter((h) => h.hour % 2 === 0) : weather;
  return (
    <ol className={`conditions ${compact ? 'conditions--compact' : ''}`} data-testid="conditions">
      {hours.map((h) => {
        const hot = h.temperature_c >= HOT;
        return (
          <li key={h.hour} className={`conditions__hour ${hot ? 'is-hot' : ''} ${h.hour === nowHour ? 'is-now' : ''}`}>
            <span className="conditions__time">{String(h.hour).padStart(2, '0')}</span>
            <span className="conditions__icon" aria-hidden="true">
              {h.rain ? <CloudRain size={22} /> : h.wind_kmh >= WINDY ? <Wind size={22} /> : <Sun size={22} />}
            </span>
            <span className="conditions__temp">{Math.round(h.temperature_c)}°</span>
            <span className="conditions__wind">{Math.round(h.wind_kmh)}<small>km/h</small></span>
          </li>
        );
      })}
    </ol>
  );
}
