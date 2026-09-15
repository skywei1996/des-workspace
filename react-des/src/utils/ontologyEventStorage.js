export const ONTOLOGY_EVENT_STORAGE_KEY = "workmate-ontology-event-types";
export const ONTOLOGY_EVENTS_UPDATED_EVENT = "des:ontology-events-updated";

const isBrowser = () => typeof window !== "undefined";

const parseEvents = (raw) => {
  try {
    const value = JSON.parse(raw || "[]");
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
};

export const loadOntologyEvents = () => {
  if (!isBrowser()) return [];

  const persisted = window.localStorage.getItem(ONTOLOGY_EVENT_STORAGE_KEY);
  if (persisted !== null) return parseEvents(persisted);

  const legacyEvents = parseEvents(window.sessionStorage.getItem(ONTOLOGY_EVENT_STORAGE_KEY));
  if (legacyEvents.length) {
    window.localStorage.setItem(ONTOLOGY_EVENT_STORAGE_KEY, JSON.stringify(legacyEvents));
  }
  return legacyEvents;
};

export const saveOntologyEvents = (events) => {
  if (!isBrowser()) return;

  const normalized = Array.isArray(events) ? events : [];
  window.localStorage.setItem(ONTOLOGY_EVENT_STORAGE_KEY, JSON.stringify(normalized));
  window.dispatchEvent(new CustomEvent(ONTOLOGY_EVENTS_UPDATED_EVENT, { detail: normalized }));
};

export const getEnabledOntologyEvents = () => loadOntologyEvents().filter((event) => event.enabled);

export const findOntologyEvent = (eventId) => loadOntologyEvents().find((event) => event.id === eventId) || null;

export const subscribeOntologyEvents = (listener) => {
  if (!isBrowser()) return () => {};

  const handleCustomEvent = (event) => listener(Array.isArray(event.detail) ? event.detail : loadOntologyEvents());
  const handleStorage = (event) => {
    if (event.storageArea === window.localStorage && event.key === ONTOLOGY_EVENT_STORAGE_KEY) {
      listener(parseEvents(event.newValue));
    }
  };

  window.addEventListener(ONTOLOGY_EVENTS_UPDATED_EVENT, handleCustomEvent);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(ONTOLOGY_EVENTS_UPDATED_EVENT, handleCustomEvent);
    window.removeEventListener("storage", handleStorage);
  };
};