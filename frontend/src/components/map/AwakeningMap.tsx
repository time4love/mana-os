"use client";

import { useMemo, useState, useRef, useCallback, useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  useMapEvents,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import type { MapPinRow, MapPinType } from "@/lib/supabase/types";
import {
  transmutePOI,
  type TransmutedPOIWithCoords,
  type TransmutedIconKind,
  type TransmuterLocale,
} from "@/lib/utils/matrixTransmuter";
import MarkerClusterGroup from "react-leaflet-markercluster";
import "leaflet/dist/leaflet.css";
import "react-leaflet-markercluster/styles";

const OSM_URL = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
const OVERPASS_ENDPOINT = "https://overpass-api.de/api/interpreter";
const NOMINATIM_SEARCH = "https://nominatim.openstreetmap.org/search";
const TRANSMUTER_DEBOUNCE_MS = 500;
const SEARCH_DEBOUNCE_MS = 400;

const DEFAULT_CENTER: L.LatLngTuple = [32.0853, 34.7818];
const DEFAULT_ZOOM = 11;

/** Zoom level at which Overpass POIs are fetched; below this, only user pins show. */
const MIN_ZOOM_FOR_OVERPASS = 15;

/** Overpass query: amenities and shops in bbox so transmuted + fallback POIs render. */
function buildOverpassQuery(south: number, west: number, north: number, east: number): string {
  return `[out:json][timeout:12];
(
  node["amenity"](${south},${west},${north},${east});
  node["shop"](${south},${west},${north},${east});
);
out body 500;`;
}

interface OverpassElement {
  type: string;
  id: number;
  lat?: number;
  lon?: number;
  tags?: Record<string, string>;
}

interface OverpassResponse {
  elements?: OverpassElement[];
}

interface NominatimResult {
  place_id: number;
  lat: string;
  lon: string;
  display_name: string;
  type?: string;
  class?: string;
}

async function fetchTransmutedPOIsInBounds(
  bounds: L.LatLngBounds,
  locale: TransmuterLocale,
  signal?: AbortSignal
): Promise<TransmutedPOIWithCoords[]> {
  const south = bounds.getSouth();
  const west = bounds.getWest();
  const north = bounds.getNorth();
  const east = bounds.getEast();
  const query = buildOverpassQuery(south, west, north, east);
  const res = await fetch(OVERPASS_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: query,
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as OverpassResponse;
  const elements = data.elements ?? [];
  const result: TransmutedPOIWithCoords[] = [];
  for (const el of elements) {
    if (el.type !== "node" || el.lat == null || el.lon == null || !el.tags) continue;
    const transmuted = transmutePOI(el.tags, locale);
    if (transmuted) {
      result.push({
        ...transmuted,
        lat: el.lat,
        lng: el.lon,
        osmId: `node/${el.id}`,
      });
    }
  }
  return result;
}

function createDivIconForType(type: MapPinType): L.DivIcon {
  const color =
    type === "vision_seed"
      ? "#d97706"
      : type === "abundance_anchor"
        ? "#059669"
        : "#0d9488";
  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: rgba(253, 251, 247, 0.95);
      border: 1px solid rgba(209, 221, 212, 0.8);
      box-shadow: 0 2px 8px rgba(26, 46, 37, 0.08);
      color: ${color};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${type === "vision_seed" ? "<circle cx=\"12\" cy=\"12\" r=\"5\"/><path d=\"M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42\"/>" : type === "abundance_anchor" ? "<path d=\"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.64 2 5.5 0 3.59-2.91 6.5-6.5 6.5H11z\"/><path d=\"M14 14c-1.38 0-2.5-1.12-2.5-2.5 0-.75.33-1.42.84-1.88L12 7l1.66 2.62c.51.46.84 1.13.84 1.88 0 1.38-1.12 2.5-2.5 2.5z\"/>" : "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>"}
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: "awakening-pin",
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40],
  });
}

/** Marker icon for untransmuted POIs: shows raw matrix emoji (e.g. ⛽, 🕍). */
function createDivIconForEmoji(emoji: string): L.DivIcon {
  const escaped = emoji.replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(253, 251, 247, 0.88);
      border: 1px solid rgba(209, 221, 212, 0.6);
      box-shadow: 0 1px 4px rgba(26, 46, 37, 0.08);
      font-size: 18px;
      line-height: 1;
    ">
      ${escaped}
    </div>
  `;
  return L.divIcon({
    html,
    className: "transmuted-pin transmuted-pin-emoji",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

/** Translucent markers for transmuted matrix POIs (differentiate from user-dropped pins). */
function createDivIconForTransmuted(kind: TransmutedIconKind): L.DivIcon {
  const color =
    kind === "pillar"
      ? "#78716c"
      : kind === "basket"
        ? "#059669"
        : kind === "spark"
          ? "#a16207"
          : "#4a7c59";
  const svgPaths: Record<TransmutedIconKind, string> = {
    pillar:
      "<path d=\"M4 21v-2a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v2\"/><path d=\"M12 2v4\"/><path d=\"M8 6h8\"/><path d=\"M6 10v10\"/><path d=\"M18 10v10\"/><path d=\"M12 6l-2 14\"/><path d=\"m12 6 2 14\"/>",
    basket:
      "<path d=\"M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 3.64 2 5.5 0 3.59-2.91 6.5-6.5 6.5H11z\"/><path d=\"M14 14c-1.38 0-2.5-1.12-2.5-2.5 0-.75.33-1.42.84-1.88L12 7l1.66 2.62c.51.46.84 1.13.84 1.88 0 1.38-1.12 2.5-2.5 2.5z\"/>",
    spark:
      "<path d=\"m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z\"/>",
    pin:
      "<path d=\"M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z\"/>",
  };
  const html = `
    <div style="
      display: flex;
      align-items: center;
      justify-content: center;
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: rgba(253, 251, 247, 0.78);
      border: 1px solid rgba(209, 221, 212, 0.6);
      box-shadow: 0 1px 4px rgba(26, 46, 37, 0.06);
      color: ${color};
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        ${svgPaths[kind]}
      </svg>
    </div>
  `;
  return L.divIcon({
    html,
    className: "transmuted-pin",
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
}

export interface AwakeningMapProps {
  pins: MapPinRow[];
  onMapClick?: (lat: number, lng: number) => void;
  /** When true, clicking the map sets the selected position (for drop-pin flow). */
  pickerMode?: boolean;
  /** Optional initial center (lat, lng). */
  center?: L.LatLngTuple;
  /** Optional initial zoom. */
  zoom?: number;
  /** Locale for transmuted POI labels (he/en). */
  locale?: TransmuterLocale;
}

function MapClickHandler({
  pickerMode,
  onMapClick,
}: {
  pickerMode?: boolean;
  onMapClick?: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      if (pickerMode && onMapClick) {
        onMapClick(e.latlng.lat, e.latlng.lng);
      }
    },
  });
  return null;
}

function FlyToController({
  target,
  onFlown,
}: {
  target: { lat: number; lon: number } | null;
  onFlown: () => void;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.flyTo([target.lat, target.lon], 16, { duration: 1.2 });
    onFlown();
  }, [map, target, onFlown]);
  return null;
}

/** Reports current zoom to parent so we can show "zoom in" toast and gate Overpass fetch. */
function ZoomReporter({ onZoomChange }: { onZoomChange: (zoom: number) => void }) {
  const map = useMap();
  useEffect(() => {
    onZoomChange(map.getZoom());
  }, [map, onZoomChange]);
  useMapEvents({
    zoomend() {
      onZoomChange(map.getZoom());
    },
    moveend() {
      onZoomChange(map.getZoom());
    },
  });
  return null;
}

/** Cluster type from leaflet.markercluster (getChildCount). */
interface MarkerClusterLike {
  getChildCount(): number;
}

/** Solarpunk "Mana Node" cluster icon: emerald glow, soft circle, white count. */
function createClusterIcon(cluster: MarkerClusterLike): L.DivIcon {
  const count = cluster.getChildCount();
  return L.divIcon({
    html: `<span class="marker-cluster-mana-count">${count}</span>`,
    className: "marker-cluster-mana",
    iconSize: L.point(44, 44),
    iconAnchor: L.point(22, 22),
  });
}

async function searchNominatim(
  query: string,
  signal?: AbortSignal
): Promise<NominatimResult[]> {
  if (!query.trim()) return [];
  const params = new URLSearchParams({
    format: "json",
    q: query.trim(),
    limit: "8",
  });
  const res = await fetch(`${NOMINATIM_SEARCH}?${params}`, {
    headers: {
      Accept: "application/json",
      "User-Agent": "ManaOS-AwakeningMap/1.0 (Healing OS map search)",
    },
    signal,
  });
  if (!res.ok) return [];
  const data = (await res.json()) as NominatimResult[];
  return Array.isArray(data) ? data : [];
}

const SEARCH_PLACEHOLDER: Record<TransmuterLocale, string> = {
  he: "חפש במרחב...",
  en: "Search the realm...",
};

function MapSearchBar({
  locale,
  onSelectResult,
}: {
  locale: TransmuterLocale;
  onSelectResult: (lat: number, lon: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<NominatimResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      if (abortRef.current) abortRef.current.abort();
      abortRef.current = new AbortController();
      setLoading(true);
      searchNominatim(query, abortRef.current.signal)
        .then((data) => {
          setResults(data);
          setOpen(true);
        })
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, SEARCH_DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSelect = useCallback(
    (r: NominatimResult) => {
      onSelectResult(parseFloat(r.lat), parseFloat(r.lon));
      setQuery("");
      setResults([]);
      setOpen(false);
    },
    [onSelectResult]
  );

  return (
    <div ref={containerRef} className="absolute top-3 start-3 end-3 z-[1000] flex justify-center pointer-events-none">
      <div className="w-full max-w-md pointer-events-auto">
        <div className="relative rounded-2xl border border-primary/20 bg-background/80 backdrop-blur-md shadow-soft-md px-3 py-2 focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/20 transition-all">
          <span className="absolute inset-y-0 start-3 flex items-center justify-center text-primary/70" aria-hidden>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
            </svg>
          </span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => query.trim() && results.length > 0 && setOpen(true)}
            placeholder={SEARCH_PLACEHOLDER[locale]}
            className="w-full bg-transparent ps-9 pe-2 py-1.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none"
            aria-label={SEARCH_PLACEHOLDER[locale]}
          />
          {loading && (
            <span className="absolute inset-y-0 end-3 flex items-center text-muted-foreground">
              <span className="animate-pulse text-xs">...</span>
            </span>
          )}
        </div>
        {open && results.length > 0 && (
          <ul className="absolute top-full mt-1 w-full max-w-md rounded-xl border border-border bg-card/95 backdrop-blur-md shadow-soft-md overflow-hidden list-none p-0 m-0">
            {results.map((r) => (
              <li key={r.place_id}>
                <button
                  type="button"
                  onClick={() => handleSelect(r)}
                  className="w-full text-start px-4 py-3 text-sm text-foreground hover:bg-primary/10 focus:bg-primary/10 focus:outline-none border-b border-border last:border-b-0 transition-colors"
                >
                  <span className="font-medium text-primary">{r.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function OverpassTransmuterLayer({
  locale,
  onFetched,
}: {
  locale: TransmuterLocale;
  onFetched: (pois: TransmutedPOIWithCoords[]) => void;
}) {
  const map = useMap();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const runFetch = useCallback(() => {
    if (map.getZoom() < MIN_ZOOM_FOR_OVERPASS) {
      onFetched([]);
      return;
    }
    const bounds = map.getBounds();
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    fetchTransmutedPOIsInBounds(
      bounds,
      locale,
      abortRef.current.signal
    ).then((pois) => {
      onFetched(pois);
    }).catch(() => {
      onFetched([]);
    });
  }, [map, locale, onFetched]);

  useEffect(() => {
    const t = setTimeout(runFetch, 100);
    return () => clearTimeout(t);
  }, [runFetch]);

  useMapEvents({
    zoomend() {
      if (map.getZoom() < MIN_ZOOM_FOR_OVERPASS) {
        onFetched([]);
      } else {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          debounceRef.current = null;
          runFetch();
        }, TRANSMUTER_DEBOUNCE_MS);
      }
    },
    moveend() {
      if (map.getZoom() < MIN_ZOOM_FOR_OVERPASS) {
        onFetched([]);
        return;
      }
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        debounceRef.current = null;
        runFetch();
      }, TRANSMUTER_DEBOUNCE_MS);
    },
  });

  return null;
}

export function AwakeningMap({
  pins,
  onMapClick,
  pickerMode = false,
  center = DEFAULT_CENTER,
  zoom = DEFAULT_ZOOM,
  locale = "en",
}: AwakeningMapProps) {
  const [transmutedPOIs, setTransmutedPOIs] = useState<TransmutedPOIWithCoords[]>([]);
  const [flyToTarget, setFlyToTarget] = useState<{ lat: number; lon: number } | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number | null>(null);

  const pinIcons = useMemo(() => {
    const m = new Map<MapPinType, L.DivIcon>();
    (["vision_seed", "abundance_anchor", "resource_pledge"] as const).forEach(
      (t) => m.set(t, createDivIconForType(t))
    );
    return m;
  }, []);

  const transmutedIcons = useMemo(() => {
    const m = new Map<TransmutedIconKind, L.DivIcon>();
    (["pillar", "basket", "spark", "pin"] as const).forEach((k) =>
      m.set(k, createDivIconForTransmuted(k))
    );
    return m;
  }, []);

  const emojiIcons = useMemo(() => {
    const m = new Map<string, L.DivIcon>();
    const emojis = [...new Set(transmutedPOIs.map((p) => p.emoji).filter(Boolean))] as string[];
    emojis.forEach((e) => m.set(e, createDivIconForEmoji(e)));
    return m;
  }, [transmutedPOIs]);

  const handleTransmutedFetched = useCallback((pois: TransmutedPOIWithCoords[]) => {
    setTransmutedPOIs(pois);
  }, []);

  const [mapReady, setMapReady] = useState(false);
  const mapKeyRef = useRef(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMapReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  useEffect(() => {
    if (mapReady) mapKeyRef.current += 1;
  }, [mapReady]);

  const handleSearchSelect = useCallback((lat: number, lon: number) => {
    setFlyToTarget({ lat, lon });
  }, []);

  const handleZoomChange = useCallback((zoom: number) => {
    setZoomLevel(zoom);
  }, []);

  const showZoomPrompt = zoomLevel !== null && zoomLevel < MIN_ZOOM_FOR_OVERPASS && !pickerMode;

  const ZOOM_PROMPT = {
    he: "התקרב כדי לחשוף את שכבות המרחב",
    en: "Zoom in to reveal spatial layers",
  };

  const mapStyles = (
    <style>{`
        .leaflet-container {
          height: 100% !important;
          width: 100% !important;
        }
        .leaflet-tile-pane {
          filter: sepia(18%) hue-rotate(75deg) saturate(140%) brightness(96%);
        }
        .awakening-pin,
        .transmuted-pin {
          background: transparent !important;
          border: none !important;
        }
        .marker-cluster-mana {
          background: rgba(16, 185, 129, 0.8) !important;
          border-radius: 50% !important;
          border: 1px solid rgba(255, 255, 255, 0.4) !important;
          box-shadow: 0 0 15px rgba(16, 185, 129, 0.6) !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
        }
        .marker-cluster-mana div {
          background: transparent !important;
          margin: 0 !important;
        }
        .marker-cluster-mana-count {
          color: white !important;
          font-size: 14px !important;
          font-weight: 600 !important;
          line-height: 1 !important;
        }
      `}</style>
  );

  if (!mapReady) {
    return (
      <div className="relative h-full min-h-[300px] w-full rounded-xl overflow-hidden bg-muted/30">
        {mapStyles}
      </div>
    );
  }

  return (
    <div className="relative h-full min-h-[300px] w-full rounded-xl overflow-hidden">
      {mapStyles}
      {showZoomPrompt && (
        <div
          className="absolute top-4 start-1/2 -translate-x-1/2 z-[1000] pointer-events-none px-4 py-2 rounded-xl bg-background/90 backdrop-blur-md border border-primary/20 shadow-soft-md text-sm text-foreground text-center"
          role="status"
          aria-live="polite"
        >
          {ZOOM_PROMPT[locale]}
        </div>
      )}
      {!pickerMode && (
        <MapSearchBar locale={locale} onSelectResult={handleSearchSelect} />
      )}
      <MapContainer
        key={`awakening-map-${mapKeyRef.current}`}
        center={center}
        zoom={zoom}
        className="h-full w-full"
        scrollWheelZoom
      >
        <TileLayer url={OSM_URL} attribution={OSM_ATTRIBUTION} />
        {!pickerMode && (
          <FlyToController
            target={flyToTarget}
            onFlown={() => setFlyToTarget(null)}
          />
        )}
        <MapClickHandler pickerMode={pickerMode} onMapClick={onMapClick} />
        {!pickerMode && (
          <ZoomReporter onZoomChange={handleZoomChange} />
        )}
        {!pickerMode && (
          <OverpassTransmuterLayer
            locale={locale}
            onFetched={handleTransmutedFetched}
          />
        )}
        <MarkerClusterGroup
          iconCreateFunction={createClusterIcon}
          showCoverageOnHover={false}
        >
          {pins.map((pin) => (
            <Marker
              key={pin.id}
              position={[pin.lat, pin.lng]}
              icon={pinIcons.get(pin.pin_type) ?? pinIcons.get("abundance_anchor")!}
            >
              <Popup>
                <div className="min-w-[180px] text-foreground">
                  <p className="font-medium text-foreground">{pin.title}</p>
                  {pin.description ? (
                    <p className="mt-1 text-sm text-muted-foreground">
                      {pin.description}
                    </p>
                  ) : null}
                </div>
              </Popup>
            </Marker>
          ))}
          {transmutedPOIs.map((poi) => (
            <Marker
              key={poi.osmId}
              position={[poi.lat, poi.lng]}
              icon={
                poi.emoji
                  ? emojiIcons.get(poi.emoji) ?? createDivIconForEmoji(poi.emoji)
                  : transmutedIcons.get(poi.icon) ?? transmutedIcons.get("pin")!
              }
            >
              <Popup>
                <div className="min-w-[200px] text-foreground">
                  <p className="font-semibold text-primary">{poi.name}</p>
                  {poi.rawMatrixCode ? (
                    <p className="mt-1 font-mono text-xs text-muted-foreground bg-black/5 rounded px-1.5 py-0.5 border border-border/60">
                      [{poi.rawMatrixCode}]
                    </p>
                  ) : null}
                  {poi.originalName && poi.originalName.length > 0 ? (
                    <p className="mt-0.5 text-xs text-muted-foreground italic">
                      {locale === "he" ? "לשעבר: " : "Formerly: "}
                      {poi.originalName}
                    </p>
                  ) : null}
                  <p className="mt-1 text-sm text-muted-foreground">
                    {poi.description}
                  </p>
                </div>
              </Popup>
            </Marker>
          ))}
        </MarkerClusterGroup>
      </MapContainer>
    </div>
  );
}

