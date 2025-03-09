// First, install Firebase: npm install firebase

// In a new file: src/firebase.js
import {initializeApp} from 'firebase/app';
import {getAnalytics} from 'firebase/analytics';
import {getStorage} from 'firebase/storage';

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: 'AIzaSyCMsHJl-AOoFhSEPaEUSTNkHKyhYq2kW1o',
  authDomain: 'qr-code-lounge-web.firebaseapp.com',
  projectId: 'qr-code-lounge-web',
  storageBucket: 'qr-code-lounge-web.appspot.com', // Note: corrected this line
  messagingSenderId: '817878542488',
  appId: '1:817878542488:web:36c729aeef485f0776c8ed',
  measurementId: 'G-2YBXPSCP92',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const storage = getStorage(app);
