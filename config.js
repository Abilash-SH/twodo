/* Twodo cloud settings. Everything here is PUBLIC by design (it identifies your Firebase project,
   it doesn't grant access). Access is enforced by firebase.rules.json + your login.
   Fill these in once (see README → "Turn on accounts & sync"). Leave empty to use Twodo offline only. */
window.TWODO_CONFIG = {
  firebase: {
    apiKey: 'AIzaSyB54Y2UePd87RpvvOeOG45j4NWyMqdg8tE',        // Firebase console → Project settings → General → Web API key
    databaseURL: 'https://twodo-31a47-default-rtdb.asia-southeast1.firebasedatabase.app',   // Realtime Database → Data tab, e.g. https://your-app-default-rtdb.firebaseio.com
  },
  vapidPublicKey: '',  // For push reminders (README → "Turn on push reminders")
};
