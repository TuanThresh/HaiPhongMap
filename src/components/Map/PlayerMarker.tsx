export function createPlayerMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'player-marker';
  marker.setAttribute('aria-label', 'Spawn position');
  marker.innerHTML =
    '<span class="player-marker-dot"></span><span class="player-marker-label">SPAWN</span>';
  return marker;
}
