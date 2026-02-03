export type Announcement = {
  id: string;
  title: string;
  body: string;
  tag: "IMPORTANTE" | "INFO" | "ALERTA";
  date: string;
};

