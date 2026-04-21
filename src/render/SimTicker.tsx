import { useFrame } from "@react-three/fiber";
import { useGame } from "../store";

export const SimTicker = () => {
  useFrame(() => {
    useGame.getState().tick(performance.now() / 1000);
  });
  return null;
};
