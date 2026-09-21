// The snapshot reuses a source string across elements that need different Italian.
// "Monitoring" is both the second word of the home heading "Multi-Dimensional<br>Monitoring"
// and the label of the home "12,000+ hectares" tile, which the client wants as "Monitoraggio".
export const elementOverrides = {
  it: {
    "91cfe0e": { Monitoring: "multi-dimensione" },
  },
};
