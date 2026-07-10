/* Arcade.register — games self-register here on load. Order added =
   order shown in the hub. Each game provides metadata + a create()
   factory returning the lifecycle object the shell drives. */
(function () {
  const games = [];
  const byId = {};

  function register(def) {
    if (!def || !def.id || typeof def.create !== "function") {
      console.warn("Arcade.register: invalid game def", def);
      return;
    }
    if (byId[def.id]) { console.warn("Arcade.register: duplicate id", def.id); return; }
    const game = Object.assign({
      name: def.id,
      tagline: "",
      accent: "#6bb8f0",
      complexity: "low",
      controls: "arrows",
      scoreLabel: "Score",
      hint: ""
    }, def);
    games.push(game);
    byId[def.id] = game;
  }

  window.Arcade = window.Arcade || {};
  window.Arcade.register = register;
  window.Arcade.games = games;
  window.Arcade.gameById = (id) => byId[id];
})();
