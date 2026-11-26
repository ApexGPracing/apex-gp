/* VIP codes are checked online now (supabase/vip-codes.sql): the database holds them and the game never sees
   the list, so there is nothing here to find. A device that redeemed a code keeps a secret token from the
   database, which is re-checked every time the game starts. */
export const VIP_CODES = [];
export const VIP_REVOKED = [];
