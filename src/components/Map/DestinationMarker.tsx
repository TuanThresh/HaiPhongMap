export function createDestinationMarkerElement() {
  const marker = document.createElement('div');
  marker.className = 'destination-marker';
  marker.setAttribute('aria-label', 'Challenge destination');
  marker.innerHTML =
    '<span class="destination-marker-star">★</span><span class="destination-marker-label">TARGET</span>';
  return marker;
}
