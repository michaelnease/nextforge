import { useState } from "react";
export function useTestfeature() {
  const [state, setState] = useState({});
  return { state, setState };
}
