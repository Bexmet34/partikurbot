/**
 * partyAllocator.js
 * Implements Maximum Bipartite Matching to assign multi-role players to empty slots.
 */

/**
 * Assigns users in the multi-role waitlist to the remaining empty slots in the party.
 * 
 * @param {Array} multiRoleUsers - Array of objects like { userId: '123', roleIndices: [0, 2, 4], nickname: 'Player1' }
 * @param {Array} emptySlots - Array of objects like { index: 0, role: 'Tank' }
 * @param {Object} existingMatches - (Optional) Object mapping slotIndex -> user object already occupying it. These users can be displaced if needed.
 * @returns {Object} { assignments, unassignedUsers } 
 *   - assignments: Object mapping slotIndex -> userId
 *   - unassignedUsers: Array of user objects that couldn't be assigned
 */
function allocateMultiRoleUsers(multiRoleUsers, emptySlots, existingMatches = {}) {
    const match = { ...existingMatches }; 
    
    // allSlots includes truly empty slots AND slots currently occupied by flexible users in existingMatches
    const allSlotsMap = new Map();
    emptySlots.forEach(s => allSlotsMap.set(String(s.index), s));
    
    for (const [sIndex, user] of Object.entries(existingMatches)) {
        // Find the user's role from their roleIndices to reconstruct the slot object
        // Or we just need the index for the DFS
        allSlotsMap.set(String(sIndex), { index: sIndex, role: 'Occupied' });
    }
    
    const allSlots = Array.from(allSlotsMap.values());
    
    // Sort to prioritize empty slots over occupied slots, to minimize displacements
    allSlots.sort((a, b) => {
        const aOccupied = existingMatches[String(a.index)] ? 1 : 0;
        const bOccupied = existingMatches[String(b.index)] ? 1 : 0;
        return aOccupied - bOccupied;
    });

    function dfs(user, visited) {
        for (const slot of allSlots) {
            if (user.roleIndices.map(r => String(r)).includes(String(slot.index))) {
                if (visited.has(String(slot.index))) continue;
                visited.add(String(slot.index));
                
                if (!(String(slot.index) in match) || dfs(match[String(slot.index)], visited)) {
                    match[String(slot.index)] = user;
                    return true;
                }
            }
        }
        return false;
    }
    
    const unassignedUsers = [];
    
    for (const user of multiRoleUsers) {
        const visited = new Set();
        if (!dfs(user, visited)) {
            unassignedUsers.push(user);
        }
    }
    
    // Format assignments nicely
    const assignments = {};
    for (const [slotIndex, user] of Object.entries(match)) {
        assignments[slotIndex] = user.userId;
    }
    
    return { assignments, unassignedUsers };
}

module.exports = {
    allocateMultiRoleUsers
};
