export enum PlayerType {
    Admin, 
    HumanPlayer, 
    VirtualPlayer,
}

export enum AvatarName {
    Barbie = "Barbie",
    Nikki = "Nikki", 
    Raquelle = "Raquelle", 
    Teresa = "Teresa", 
    Ken = "Ken", 
    Blissa = "Blissa", 
    Chelsea = "Chelsea",
    Ryan = "Ryan",
    Skipper = "Skipper", 
    Stacie = "Stacie", 
    Taffy = "Taffy", 
    Tawny = "Tawny", 
}

export interface PlayerAvatar{
    imageUrl: string;
    avatarName: AvatarName; 
}

export interface Player {
    name: string;
    avatar: PlayerAvatar; // lien vers l'image choisie en asset 
    remainingPoints: number;
    lifeValue : number;
    speedValue: number; 
    attackValue: number;
    attackBonus: string; // D4 ou D6
    defenseValue: number;
    defenseBonus: string; // D4 ou D6
    remainingMovementPointsForTurn: number;
    remainingActionPointsForTurn: number;
}