import { initializeApp } from "firebase/app";
import { getAnalytics, isSupported } from "firebase/analytics";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile
} from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  orderBy,
  limit,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL
} from "firebase/storage";

// User-provided Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBJi6sSs7Zcz4o31wwAo3081sHcF6JzSuY",
  authDomain: "digitaltwin-13cdb.firebaseapp.com",
  projectId: "digitaltwin-13cdb",
  storageBucket: "digitaltwin-13cdb.firebasestorage.app",
  messagingSenderId: "499081942762",
  appId: "1:499081942762:web:67b8636e5c7d861a6e6993",
  measurementId: "G-S55GR9YJX8"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Analytics conditionally (only in supported browser environments)
let analytics = null;
if (typeof window !== "undefined") {
  isSupported()
    .then((supported) => {
      if (supported) analytics = getAnalytics(app);
    })
    .catch(() => {});
}
export { analytics };

/**
 * Format timestamp to match user's database pattern: e.g. "11/10/2026, 9:52:05 pm"
 */
export function formatDatabaseTimestamp(date = new Date()) {
  return date.toLocaleString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  }).toLowerCase();
}

/**
 * Compress an image file to an optimized Base64 JPEG data URL
 * Ensures image fits inside Firestore documents (< 1MB) and displays universally to all visitors
 */
export function compressImageFile(file, maxWidth = 800, maxHeight = 800, quality = 0.72) {
  return new Promise((resolve) => {
    if (!file || !file.type.startsWith('image/')) {
      resolve(null);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', quality);
        resolve(dataUrl);
      };
      img.onerror = () => resolve(null);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(null);
    reader.readAsDataURL(file);
  });
}

/**
 * Save civic issue report and uploaded image into Cloud Firestore under collection: 'public'
 */
export async function saveToPublicRegistry({ report, location, description, user, imageFile = null, imagePreview = null }) {
  const now = new Date();
  const formattedTimestamp = formatDatabaseTimestamp(now);
  const timestampMs = now.getTime();

  const userEmail = user?.email || (user?.isAnonymous ? "anonymous-citizen@civiclens.local" : "public-reporter@civiclens.local");
  const userId = user?.uid || "guest";
  const userName = user?.displayName || (user?.isAnonymous ? "Anonymous Citizen" : (user?.email?.split('@')[0] || "Public Citizen"));

  const issueTitle = report?.suggestedReport?.title || report?.issueCategory || "Civic Infrastructure Issue";
  const category = report?.issueCategory || "General Infrastructure";
  const severityLevel = report?.severity?.level || "Moderate";
  const details = report?.suggestedReport?.description || report?.summary || description || "Civic issue report analyzed via CivicLens AI";

  // Compress image to ensure it is embedded directly in Firestore and visible to every visitor
  let finalImageUrl = null;
  if (imageFile) {
    try {
      finalImageUrl = await compressImageFile(imageFile, 800, 800, 0.72);
    } catch (e) {
      console.warn("Failed to compress image:", e);
    }

    // Also attempt Firebase Cloud Storage upload if available
    try {
      const fileName = `public_${Date.now()}_${imageFile.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const fileRef = storageRef(storage, `civic_issues/${fileName}`);
      await uploadBytes(fileRef, imageFile);
      const downloadUrl = await getDownloadURL(fileRef);
      if (downloadUrl) {
        finalImageUrl = downloadUrl;
      }
    } catch (storageErr) {
      console.info("Storage upload notice (falling back to embedded compressed data URL):", storageErr.message);
    }
  } else if (imagePreview && imagePreview.startsWith('data:image/')) {
    finalImageUrl = imagePreview;
  }

  const docData = {
    // Top-level schema matching user's existing collections
    action: "REPORTED_CIVIC_ISSUE",
    adminEmail: userEmail,
    details: details,
    teamId: userId,
    teamName: "Public Citizen Reports",
    timestamp: formattedTimestamp,
    timestampMs: timestampMs,

    // Civic-specific metadata
    issueTitle: issueTitle,
    category: category,
    severity: severityLevel,
    isCivicIssue: report?.isCivicIssue ?? true,
    confidenceScore: report?.confidenceScore || "Medium",
    location: location || report?.suggestedReport?.locationContext || "Unspecified Location",
    userDescription: description || "",
    summary: report?.summary || "",
    visibleEvidence: report?.visibleEvidence || [],
    recommendedActions: report?.recommendedActions || [],
    urgencyNote: report?.suggestedReport?.urgencyNote || "",
    potentialImpact: report?.potentialImpact || {},
    uncertainty: report?.uncertaintyAndAssumptions || "",

    // Image fields so photos are preserved and visible to all viewers
    imageUrl: finalImageUrl || null,
    hasImage: Boolean(finalImageUrl),

    // Reporter identity info
    reporter: {
      uid: userId,
      email: userEmail,
      displayName: userName,
      isAnonymous: Boolean(user?.isAnonymous)
    },

    status: "OPEN",
    source: "CivicLens AI / Gemma 4",
    createdAt: serverTimestamp(),
    fullReport: report || {}
  };

  // Save into collection named 'public'
  const publicCollectionRef = collection(db, "public");
  const docRef = await addDoc(publicCollectionRef, docData);

  return {
    id: docRef.id,
    ...docData
  };
}

/**
 * Real-time listener for reports from the 'public' collection
 */
export function subscribeToPublicRegistry(callback, maxLimit = 30) {
  const publicCollectionRef = collection(db, "public");
  const q = query(publicCollectionRef, orderBy("timestampMs", "desc"), limit(maxLimit));

  return onSnapshot(
    q,
    (snapshot) => {
      const items = [];
      snapshot.forEach((doc) => {
        items.push({ id: doc.id, ...doc.data() });
      });
      callback(items, null);
    },
    (error) => {
      console.warn("Public collection subscription notice:", error);
      callback([], error);
    }
  );
}

// Authentication Exports
export {
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInAnonymously,
  signOut,
  onAuthStateChanged,
  updateProfile
};
