export function searchParamsMatch(aParams, bParams) {
  if ((!aParams && bParams) || (aParams && !bParams)) return false;
  else if (!aParams && !bParams) return true;
  // a and b must have the same number of keys and the same value(s) for each key.
  const aTemp = new URLSearchParams(aParams.toString());
  aTemp.sort();
  const bTemp = new URLSearchParams(bParams.toString());
  bTemp.sort();
  return aTemp.toString() === bTemp.toString();
}
