/**
 * Supprime les entrées d'un Set dont la clé est préfixée par `roomId:` (ex. pending combat / transfert).
 */
export function removePendingKeysForRoom(roomId: string, pendingKeys: Set<string>): void {
    const prefix = `${roomId}:`;
    for (const key of [...pendingKeys]) {
        if (key.startsWith(prefix)) {
            pendingKeys.delete(key);
        }
    }
}
