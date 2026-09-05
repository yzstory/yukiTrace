export type MapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  /** 序号（1 起） */
  index: number;
  /** 分组（天 / 旅程），决定颜色 */
  group: number;
  color: string;
  subtitle?: string;
  thumbUrl?: string | null;
  href?: string;
};

export type MapPath = { group: number; color: string; points: Array<[number, number]> /* [lng, lat] */ };
