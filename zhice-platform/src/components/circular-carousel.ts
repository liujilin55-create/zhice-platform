import type { CSSProperties, ComponentType } from "react";
import CircularCarouselSource from "./CircularCarousel.jsx";

export type CircularCarouselItem = {
  src: string;
  alt: string;
  title: string;
  subtitle?: string;
};

export type CircularCarouselProps = {
  items?: CircularCarouselItem[];
  preset?: string;
  intro?: string;
  cardWidth?: number;
  aspectRatio?: number;
  gap?: number;
  curve?: number;
  tilt?: number;
  perspective?: number;
  autoplay?: string;
  speed?: number;
  interval?: number;
  direction?: "left" | "right";
  draggable?: boolean;
  momentum?: number;
  snap?: boolean;
  pauseOnHover?: boolean;
  focusOnClick?: boolean;
  parallax?: number;
  stretch?: number;
  depthFade?: number;
  fadeColor?: string;
  innerShade?: number;
  cornerRadius?: number;
  captions?: boolean;
  ariaLabel?: string;
  onChange?: (index: number) => void;
  onItemClick?: (item: CircularCarouselItem, index: number) => void;
  className?: string;
  style?: CSSProperties;
};

const CircularCarousel = CircularCarouselSource as ComponentType<CircularCarouselProps>;

export default CircularCarousel;
