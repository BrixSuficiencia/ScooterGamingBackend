# ScooterGamingApp Backend

## To Run
- Access Firebase Database
- Go to Project Settings
- Go to Service Accounts
- In Firebase Admin SDK choose Node.js
- Click Generate new private key
- Rename Downloaded file to serviceAccountKey.json
- Move serviceAccountKey.json to Repo Main File
- Run "node index.js" on Terminal


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAtjOz9FnetGrOz0gA4eexBe03OBCqdBYo",
  authDomain: "scootergamingapp-94bb4.firebaseapp.com",
  projectId: "scootergamingapp-94bb4",
  storageBucket: "scootergamingapp-94bb4.firebasestorage.app",
  messagingSenderId: "453726606474",
  appId: "1:453726606474:web:d03639ef5990086de30973",
  measurementId: "G-NTRDR5R4EZ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
