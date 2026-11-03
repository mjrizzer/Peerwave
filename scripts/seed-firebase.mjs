import { initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
const project =
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.GCLOUD_PROJECT;
if (!project) throw new Error("Set NEXT_PUBLIC_FIREBASE_PROJECT_ID");
initializeApp({
  projectId: project,
  ...(process.env.FIRESTORE_EMULATOR_HOST
    ? {}
    : { credential: applicationDefault() }),
});
const categories = [
  "Education",
  "Coding and DSA",
  "Artificial Intelligence",
  "Machine Learning",
  "Data Science",
  "Doubt Clearing",
  "Career Guidance",
  "Placement Preparation",
  "Technical Interviews",
  "Communication Skills",
  "Language Learning",
  "Open Discussions",
  "Study Groups",
  "Webinars",
  "Workshops",
  "Project Collaborations",
  "Public Speaking",
  "Exam Preparation",
  "Entrepreneurship",
  "Community Discussions",
];
const db = getFirestore();
for (const [index, name] of categories.entries()) {
  const id = `category-${String(index + 1).padStart(3, "0")}`;
  const ref = db.collection("categories").doc(id);
  if (!(await ref.get()).exists)
    await ref.set({
      id,
      name,
      slug: name.toLowerCase().replaceAll(" ", "-"),
      active: true,
    });
}
console.log(`Seeded categories in ${project}; existing data preserved.`);
