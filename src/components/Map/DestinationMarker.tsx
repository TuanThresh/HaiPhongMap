export function createDestinationMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'destination-marker';
  marker.setAttribute('aria-label', 'Target destination');
  marker.innerHTML =
    '<span class="destination-marker-star">&#9733;</span><span class="destination-marker-label">TARGET</span>';
  return marker;
}
