import {
  ArrowLeftRight,
  CircleDot,
  ClipboardList,
  File,
  Home,
  Image,
  Settings,
  Sheet as SheetIcon,
  Users
} from "lucide-react";

export const primaryNav = [
  { label: "홈", icon: Home },
  { label: "시트", icon: SheetIcon },
  { label: "파일", icon: File },
  { label: "이슈", icon: CircleDot },
  { label: "양식", icon: ClipboardList },
  { label: "사진", icon: Image }
] as const;

export const secondaryNav = [
  { label: "구성원", icon: Users },
  { label: "브리지", icon: ArrowLeftRight },
  { label: "설정", icon: Settings }
] as const;

export type PrimarySection = (typeof primaryNav)[number]["label"];
export type SecondarySection = (typeof secondaryNav)[number]["label"];
export type BuildSection = PrimarySection | SecondarySection;
