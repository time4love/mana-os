"use client";

import { useAccount } from "wagmi";
import { motion } from "framer-motion";
import { useLocale } from "@/lib/i18n/context";
import { TruthWeaverInput } from "@/components/truth/TruthWeaverInput";

const transition = { duration: 0.4, ease: [0.32, 0.72, 0, 1] };
const stagger = 0.08;

const TITLE = {
  he: "מנוע האמת הפרקטלי",
  en: "The Fractal Truth Engine",
};

const SUBTITLE = {
  he: "היכנסו למרחב הגיון אפיסטמי ללא שיפוט, ללא צנזורה וללא 'פנייה לסמכות'. מהי אמת היסוד שתרצו לנעוץ במארג?",
  en: "Enter a space of epistemic logic—free from judgment, censorship, and the appeal to authority. What foundational premise do you wish to anchor?",
};

const CONNECT_PROMPT = {
  he: "חבר ארנק כדי לעגן טיעונים למארג האמת.",
  en: "Connect your wallet to anchor arguments to the Truth graph.",
};

export default function TruthPage() {
  const { locale } = useLocale();
  const isRtl = locale === "he";
  const { address } = useAccount();

  const title = locale === "he" ? TITLE.he : TITLE.en;
  const subtitle = locale === "he" ? SUBTITLE.he : SUBTITLE.en;
  const connectPrompt = locale === "he" ? CONNECT_PROMPT.he : CONNECT_PROMPT.en;

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.32, 0.72, 0, 1] }}
      className="min-h-[calc(100vh-3.5rem)] px-4 py-12 sm:px-8 sm:py-16 md:px-12"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto max-w-3xl space-y-16">
        <motion.header
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...transition, delay: stagger }}
          className="text-center space-y-6"
        >
          <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl md:text-[2.5rem] leading-tight">
            {title}
          </h1>
          <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            {subtitle}
          </p>
        </motion.header>

        {address ? (
          <motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...transition, delay: stagger * 2 }}
            className="flex flex-col items-center"
          >
            <div className="w-full max-w-2xl">
              <TruthWeaverInput
                authorWallet={address}
                onAnchored={() => {}}
                onEdgeAttached={() => {}}
              />
            </div>
          </motion.section>
        ) : (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ ...transition, delay: stagger * 2 }}
            className="text-center text-muted-foreground text-base sm:text-lg"
          >
            {connectPrompt}
          </motion.p>
        )}
      </div>
    </motion.main>
  );
}
