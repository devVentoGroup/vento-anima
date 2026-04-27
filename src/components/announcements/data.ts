import type { Announcement } from "@/components/announcements/types";
import { ANIMA_COPY } from "@/brand/anima/copy/app-copy";

export const ANNOUNCEMENTS: Announcement[] = [
  {
    id: "a-1",
    title: "Nueva política de turnos",
    body: "A partir del lunes, los check-ins deben hacerse dentro del radio definido por cada sede.",
    tag: "IMPORTANTE",
    date: "22 ene 2026",
  },
  {
    id: "a-2",
    title: "Mantenimiento programado",
    body: "El sistema estará en mantenimiento este sábado de 2:00 a 4:00 a.m.",
    tag: "ALERTA",
    date: "19 ene 2026",
  },
  {
    id: "a-3",
    title: "Nuevo módulo de documentos",
    body: ANIMA_COPY.announcementsDocumentsTeaser,
    tag: "INFO",
    date: "15 ene 2026",
  },
];

