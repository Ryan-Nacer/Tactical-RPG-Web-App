# Recette QA - Joueurs Virtuels (JV)

Objectif: verifier rapidement que le JV offensif respecte les priorites de comportement en mode Classique et CTF.

## Preconditions

- Serveur et client demarres.
- Une carte de test avec au moins: 1 porte fermee, 1 sanctuaire combat, 1 sanctuaire soin, 1 drapeau (CTF).
- Au moins 1 joueur humain + 1 JV offensif.

## Checklist (10 cas)

- [ ] 1. **Ajout JV offensif en salle d'attente**  
Le host ajoute un JV offensif. Le JV apparait comme distinct visuellement et avec son badge/profil offensif.

- [ ] 2. **Aucun ajout automatique non demande**  
Creer une salle puis attendre sans action. Aucun JV ne doit apparaitre spontanement.

- [ ] 3. **Attaque immediate en classique**  
Placer un ennemi adjacent au JV offensif avec `actionsLeft > 0`. Le JV doit attaquer immediatement (pas de fuite).

- [ ] 4. **Poursuite de l'ennemi le plus proche en classique**  
Si aucun ennemi adjacent, le JV avance vers une cible de combat (pas d'immobilite sans raison).

- [ ] 5. **Posture offensive en combat**  
Quand un combat JV offensif est declenche, sa posture choisie est toujours offensive.

- [ ] 6. **Priorite victoire immediate en CTF (porteur du drapeau)**  
Si le JV a le drapeau et peut atteindre son spawn ce tour, il s'y rend en priorite.

- [ ] 7. **Priorite porteur ennemi en CTF**  
Si un ennemi porte le drapeau, le JV offensif priorise sa poursuite avant les autres ennemis.

- [ ] 8. **Priorite recuperation du drapeau en CTF**  
Si personne ne porte le drapeau, le JV offensif avance vers le drapeau.

- [ ] 9. **Porte fermee: ouvrir si chemin plus court**  
En CTF, si ouvrir une porte reduit le cout vers drapeau/spawn, le JV va vers la porte puis l'ouvre (au lieu d'un long contournement).

- [ ] 10. **Sanctuaires: comportement offensif coherent**  
Sanctuaire combat utilise quand pertinent et disponible. Sanctuaire soin seulement en situation critique (pas sur blessure legere).

## Commandes de validation (serveur)

```powershell
npm test -- --runInBand offensive-strategy.spec.ts
npm test -- --runInBand virtual-player.service.spec.ts
npm test -- --runInBand game-session.service.spec.ts
```

## Resultat attendu global

- Le JV offensif ne fuit pas volontairement un combat.
- En CTF, l'ordre observe est: victoire immediate > porteur ennemi > drapeau > combat general.
