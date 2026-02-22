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