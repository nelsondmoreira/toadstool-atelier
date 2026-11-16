import { createRoot } from "react-dom/client";
import { WeeklyProgress } from "./components/WeeklyProgress";
import type { WeeklyProgressProps } from "./components/WeeklyProgress";

export interface WeeklyProgressHandle {
  update: (props: WeeklyProgressProps) => void;
  unmount: () => void;
}

export function mountWeeklyProgress(
  container: HTMLElement,
): WeeklyProgressHandle {
  const root = createRoot(container);

  return {
    update(props) {
      root.render(<WeeklyProgress {...props} />);
    },

    unmount() {
      root.unmount();
    },
  };
}