// First, install Firebase: npm install firebase

// In a new file: src/firebase.js
import {initializeApp} from 'firebase/app';
import {getDatabase, connectDatabaseEmulator} from 'firebase/database';
import {getStorage, connectStorageEmulator} from 'firebase/storage';

// For development debugging
const isDevelopment = process.env.NODE_ENV === 'development';

// Hardcoded fallback configuration (for development only)
const fallbackConfig = {
  apiKey: 'AIzaSyA-example-fallback-key-for-dev-only',
  authDomain: 'qr-code-lounge-web.firebaseapp.com',
  databaseURL: 'https://qr-code-lounge-web-default-rtdb.firebaseio.com',
  projectId: 'qr-code-lounge-web',
  storageBucket: 'qr-code-lounge-web.appspot.com',
  messagingSenderId: '123456789012',
  appId: '1:123456789012:web:abcdef1234567890',
};

// Function to validate Firebase config
function getValidFirebaseConfig() {
  const envConfig = {
    apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
    authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.REACT_APP_FIREBASE_DATABASE_URL,
    projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
    storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.REACT_APP_FIREBASE_APP_ID,
  };

  // Check if all required fields are present
  const requiredFields = [
    'apiKey',
    'authDomain',
    'databaseURL',
    'projectId',
    'storageBucket',
    'appId',
  ];
  const missingFields = requiredFields.filter(field => !envConfig[field]);

  if (missingFields.length > 0) {
    if (isDevelopment) {
      console.warn(
        `Firebase config missing fields: ${missingFields.join(
          ', ',
        )}. Using fallback for development.`,
      );
      return fallbackConfig;
    } else {
      console.error(
        `Firebase config missing required fields: ${missingFields.join(', ')}`,
      );
      // In production, still try with what we have rather than failing completely
      return envConfig;
    }
  }

  return envConfig;
}

// Get valid configuration
const firebaseConfig = getValidFirebaseConfig();

// Initialize Firebase
let app, database, storage;

try {
  app = initializeApp(firebaseConfig);
  database = getDatabase(app);
  storage = getStorage(app);

  // Use emulators in development if needed
  if (
    isDevelopment &&
    process.env.REACT_APP_USE_FIREBASE_EMULATORS === 'true'
  ) {
    connectDatabaseEmulator(database, 'localhost', 9000);
    connectStorageEmulator(storage, 'localhost', 9199);
    console.log('Using Firebase emulators for development');
  }

  console.log('Firebase initialized successfully');
} catch (error) {
  console.error('Error initializing Firebase:', error);

  // Create placeholder objects that will fail gracefully
  if (!database) {
    database = {
      _broken: true,
      ref: () => ({
        on: () => {},
        once: () =>
          Promise.reject(new Error('Firebase database not initialized')),
      }),
    };
  }

  if (!storage) {
    storage = {
      _broken: true,
      ref: () => ({
        put: () =>
          Promise.reject(new Error('Firebase storage not initialized')),
      }),
    };
  }
}

export {database, storage};
