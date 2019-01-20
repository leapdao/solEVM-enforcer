export function padUintArray (arr, length) {
  let res = Array.from(arr);
  for (let i = res.length; i < length; i++) { res.push(0); }
  return res;
};
