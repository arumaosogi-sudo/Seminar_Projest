import { ProseCard, PublicPage } from "@/components/student/PublicPage";

export default function Privacy() {
  return (
    <PublicPage
      title="Privacy notice"
      intro="How Digital Muscle handles your personal data, in plain English (Thailand PDPA)."
    >
      <ProseCard heading="What we store">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>Your student ID (taken from your university e-mail address)</li>
          <li>Your first name (you type it once)</li>
          <li>Your university e-mail address (@lamduan.mfu.ac.th)</li>
          <li>Your test answers and scores (pretest, posttest)</li>
        </ul>
        <p>
          We don't store your password, your Google profile photo, your surname, or anything else from your Google account.
          Game scores stay in your browser and are not saved.
        </p>
      </ProseCard>

      <ProseCard heading="Why we store it">
        <p>For teaching and learning evaluation: so your instructor can see how the class is doing before and after using
          Digital Muscle, and so you can see your own results.</p>
      </ProseCard>

      <ProseCard heading="Who can see it">
        <p>Only your instructors for this course. Other students can't see your name or scores.</p>
      </ProseCard>

      <ProseCard heading="How long we keep it">
        <p>
          Until your class is archived at the end of the semester, plus up to 1 year. After that your data is deleted, or your
          name and student ID are removed so the remaining scores can't identify you (anonymized).
        </p>
      </ProseCard>

      <ProseCard heading="Your rights & contact">
        <p>
          You can ask to see, correct or delete your data at any time. Please contact your instructor — they manage the class
          and can remove or anonymize your record.
        </p>
      </ProseCard>

      <p className="text-xs text-faint">Last updated October 2026.</p>
    </PublicPage>
  );
}
