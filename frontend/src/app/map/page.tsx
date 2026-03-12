"use client";

import { useCallback, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Sun, Leaf, HandHeart } from "lucide-react";
import { useAccount } from "wagmi";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetBody,
  SheetClose,
} from "@/components/ui/sheet";
import { getMapPins, dropPin } from "@/app/actions/map";
import type { MapPinRow, MapPinType } from "@/lib/supabase/types";
import { useLocale } from "@/lib/i18n/context";

const AwakeningMap = dynamic(
  () => import("@/components/map/AwakeningMap").then((m) => m.AwakeningMap),
  { ssr: false }
);

const STEP_COUNT = 3;

const PIN_TYPES: { value: MapPinType; labelKey: "pinTypeVisionSeed" | "pinTypeAbundanceAnchor" | "pinTypeResourcePledge"; Icon: typeof Sun }[] = [
  { value: "vision_seed", labelKey: "pinTypeVisionSeed", Icon: Sun },
  { value: "abundance_anchor", labelKey: "pinTypeAbundanceAnchor", Icon: Leaf },
  { value: "resource_pledge", labelKey: "pinTypeResourcePledge", Icon: HandHeart },
];

export default function MapPage() {
  const { locale, tMap } = useLocale();
  const isRtl = locale === "he";
  const [pins, setPins] = useState<MapPinRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [step, setStep] = useState(1);
  const [pinType, setPinType] = useState<MapPinType>("abundance_anchor");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [placing, setPlacing] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const { address } = useAccount();

  const loadPins = useCallback(async () => {
    setLoading(true);
    const result = await getMapPins();
    setLoading(false);
    if (result.success) setPins(result.pins);
  }, []);

  useEffect(() => {
    loadPins();
  }, [loadPins]);

  const resetSheet = useCallback(() => {
    setStep(1);
    setPinType("abundance_anchor");
    setTitle("");
    setDescription("");
    setLat(null);
    setLng(null);
    setMessage(null);
  }, []);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setSheetOpen(open);
      if (!open) resetSheet();
    },
    [resetSheet]
  );

  const handleMapClick = useCallback((newLat: number, newLng: number) => {
    setLat(newLat);
    setLng(newLng);
  }, []);

  const useMyLocation = useCallback(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      },
      () => setMessage({ type: "error", text: tMap("errorGeneric") })
    );
  }, [tMap]);

  const handlePlacePin = useCallback(async () => {
    if (!address) {
      setMessage({ type: "error", text: tMap("connectWalletToPin") });
      return;
    }
    if (lat === null || lng === null) {
      setMessage({ type: "error", text: tMap("clickMapToSet") });
      return;
    }
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;

    setPlacing(true);
    setMessage(null);
    const result = await dropPin(
      address,
      pinType,
      lat,
      lng,
      trimmedTitle,
      description.trim()
    );
    setPlacing(false);

    if (result.success) {
      setMessage({ type: "success", text: tMap("successMessage") });
      await loadPins();
      setTimeout(() => {
        setSheetOpen(false);
        resetSheet();
      }, 1400);
    } else {
      setMessage({ type: "error", text: result.error || tMap("errorGeneric") });
    }
  }, [address, lat, lng, pinType, title, description, tMap, loadPins, resetSheet]);

  return (
    <main
      className="flex flex-col h-[calc(100dvh-3.5rem)] w-full bg-background"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex-1 relative min-h-0 w-full">
        {loading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-background">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-muted-foreground"
            >
              …
            </motion.div>
          </div>
        ) : (
          <AwakeningMap pins={pins} locale={locale} />
        )}
      </div>

      <motion.div
        className="absolute bottom-6 start-1/2 -translate-x-1/2 z-[1000]"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
      >
        <button
          type="button"
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-2 rounded-2xl bg-primary px-6 py-4 text-base font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          aria-label={tMap("fabAnchorAbundance")}
        >
          <MapPin className="size-5" aria-hidden />
          <span>{tMap("fabAnchorAbundance")}</span>
        </button>
      </motion.div>

      <Sheet open={sheetOpen} onOpenChange={handleOpenChange}>
        <SheetContent
          side={isRtl ? "start" : "end"}
          className="flex flex-col gap-0 max-w-sm sm:max-w-md"
        >
          <SheetHeader className="border-border/50 border-b pb-4">
            <SheetTitle className="text-lg font-semibold text-foreground">
              {tMap("fabAnchorAbundance")}
            </SheetTitle>
          </SheetHeader>
          <SheetBody className="flex flex-col gap-6 pt-6 overflow-y-auto">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -12 : 12 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-4"
                >
                  <p className="text-sm font-medium text-foreground">
                    {tMap("step1Title")}
                  </p>
                  <div className="flex flex-col gap-2">
                    {PIN_TYPES.map(({ value, labelKey, Icon }) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => {
                          setPinType(value);
                          setStep(2);
                        }}
                        className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-start text-foreground shadow-soft transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      >
                        <Icon className="size-5 text-primary shrink-0" />
                        <span>{tMap(labelKey)}</span>
                      </button>
                    ))}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -12 : 12 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-4"
                >
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="text-sm text-muted-foreground hover:text-foreground self-start"
                  >
                    ←
                  </button>
                  <p className="text-sm font-medium text-foreground">
                    {tMap("step2Title")}
                  </p>
                  <div className="flex flex-col gap-3">
                    <label className="text-sm text-muted-foreground">
                      {tMap("titleLabel")}
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={tMap("titlePlaceholder")}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                    <label className="text-sm text-muted-foreground">
                      {tMap("descriptionLabel")}
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder={tMap("descriptionPlaceholder")}
                      rows={3}
                      className="w-full rounded-xl border border-border bg-background px-4 py-3 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-none"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
                    disabled={!title.trim()}
                  >
                    {tMap("nextToLocation")}
                  </button>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: isRtl ? 12 : -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: isRtl ? -12 : 12 }}
                  transition={{ duration: 0.25 }}
                  className="flex flex-col gap-4"
                >
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="text-sm text-muted-foreground hover:text-foreground self-start"
                  >
                    ←
                  </button>
                  <p className="text-sm font-medium text-foreground">
                    {tMap("step3Title")}
                  </p>
                  <button
                    type="button"
                    onClick={useMyLocation}
                    className="w-full rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground shadow-soft transition hover:border-primary/40 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {tMap("useMyLocation")}
                  </button>
                  <p className="text-xs text-muted-foreground">
                    {tMap("clickMapToSet")}
                  </p>
                  <div className="h-[220px] rounded-xl border border-border overflow-hidden bg-muted/30">
                    <AwakeningMap
                      pins={[]}
                      pickerMode
                      onMapClick={handleMapClick}
                    />
                  </div>
                  {lat !== null && lng !== null && (
                    <p className="text-xs text-muted-foreground">
                      {lat.toFixed(5)}, {lng.toFixed(5)}
                    </p>
                  )}
                  {message && (
                    <p
                      className={`text-sm ${message.type === "success" ? "text-primary" : "text-amber-800 dark:text-amber-200"}`}
                    >
                      {message.text}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handlePlacePin}
                    disabled={placing || lat === null || lng === null}
                    className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-medium text-primary-foreground shadow-soft transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:pointer-events-none"
                  >
                    {placing ? tMap("placing") : tMap("placePin")}
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </SheetBody>
        </SheetContent>
      </Sheet>
    </main>
  );
}
