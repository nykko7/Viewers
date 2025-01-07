export const formatValue = (value: number) => {
  return value.toLocaleString('es-CL', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
