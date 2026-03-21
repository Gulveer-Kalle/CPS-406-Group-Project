// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAbjuH0K0tmIDwzCNSbstQroVKUij0j64c",
  authDomain: "co-op-connect-97651.firebaseapp.com",
  projectId: "co-op-connect-97651",
  storageBucket: "co-op-connect-97651.firebasestorage.app",
  messagingSenderId: "299131327226",
  appId: "1:299131327226:web:60f6ab10d5dc0c1c41af43",
  measurementId: "G-9JF111J1JZ"
};

// Initialize Firebase
const app = firebase.initializeApp(firebaseConfig);

// Export Firebase services globally
const auth = firebase.auth();
const db = firebase.firestore();
const storage = firebase.storage ? firebase.storage() : null;
