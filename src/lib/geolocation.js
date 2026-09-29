// Browser Geolocation API wrapper.
//
// The coordinates produced here always come from the STUDENT's own device
// while their QR is on screen (spec section 17). They are pushed to the
// update-student-location Edge Function, which stamps them on the token row;
// the scanner never contributes its own position to the decision.

export const GEOLOCATION_MESSAGES = {
  1: "Location permission was denied. Allow location access for this site to verify attendance.",
  2: "Your location could not be determined. Move to an open area and try again.",
  3: "The location request timed out. Please try again.",
  unsupported: "This browser does not support location access.",
  unavailable: "Location services are turned off. Enable them to verify attendance.",
};

function createGeolocationError(message, code) {
  const error = new Error(message);
  error.code = code;
  return error;
}

// Resolves with { latitude, longitude, accuracy } or rejects with a message
// that is safe to show directly to the student.
export function getCurrentPosition(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(createGeolocationError(GEOLOCATION_MESSAGES.unsupported, "unsupported"));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) =>
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
        }),
      (error) => {
        const message = GEOLOCATION_MESSAGES[error.code] || GEOLOCATION_MESSAGES[2];
        reject(createGeolocationError(message, error.code ?? "unavailable"));
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 10000,
        ...options,
      },
    );
  });
}

// Feature detection used to decide whether to show the location call to action.
export function isGeolocationSupported() {
  return typeof navigator !== "undefined" && Boolean(navigator.geolocation);
}
