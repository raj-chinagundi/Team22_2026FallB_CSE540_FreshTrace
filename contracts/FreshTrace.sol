// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./IFreshTrace.sol";

/// @title FreshTrace
/// @notice Tracks batches of fresh produce from the farm to the retailer.
/// Supply chain parties use MetaMask to update a batch, a simulated sensor
/// posts reading summaries, and customers can read everything through
/// the view functions without a wallet.
/// Types, events and errors are defined in IFreshTrace.sol.
contract FreshTrace is IFreshTrace {
    // ---- Storage ----

    address public immutable admin;   // deployer, the only one who can assign roles
    mapping(address => Role) public roleOf;

    // Batch IDs start at 1 so that 0 can mean "no batch"
    uint256 public batchCount;

    mapping(uint256 => Batch) internal batches;            // batchId => batch details
    mapping(uint256 => TraceRecord[]) internal histories;  // batchId => custody/status history
    mapping(uint256 => Reading[]) internal readings;       // batchId => sensor summaries

    constructor() {
        admin = msg.sender;
    }

    // ---- Roles ----

    modifier onlyAdmin() {
        if (msg.sender != admin) revert NotAdmin();
        _;
    }

    // ex. onlyRole(Role.Farmer)
    modifier onlyRole(Role required) {
        Role actual = roleOf[msg.sender];
        if (actual != required) revert WrongRole(required, actual);
        _;
    }

    // Admin gives a wallet its role (or Role.None to remove it)
    function setRole(address account, Role role) external onlyAdmin {
        roleOf[account] = role;
        emit RoleAssigned(account, role);
    }

    // Only these roles can receive a batch. Farmer, regulator and sensor can't.
    // Used in transferCustody to check the recipient.
    function _canHoldBatch(Role role) internal pure returns (bool) {
        return role == Role.Packer
            || role == Role.Carrier
            || role == Role.DistributionCenter
            || role == Role.Retailer;
    }

    // ---- Batch checks ----

    // Batch ID must be between 1 and batchCount
    modifier batchExists(uint256 batchId) {
        if (batchId == 0 || batchId > batchCount) revert BatchNotFound(batchId);
        _;
    }

    modifier onlyHolder(uint256 batchId) {
        if (batches[batchId].currentHolder != msg.sender) revert NotCurrentHolder();
        _;
    }

    // A flagged or recalled batch is frozen, so no transfers or status changes
    modifier whenMovable(uint256 batchId) {
        if (batches[batchId].recalled) revert BatchIsRecalled(batchId);
        if (batches[batchId].flagged) revert BatchIsFlagged(batchId);
        _;
    }

    // ---- Batch lifecycle ----

    // Farmer creates a new batch with its safe range and certificate CID
    function registerBatch(
        string calldata product,
        uint32 quantityKg,
        int32 minLimit,
        int32 maxLimit,
        string calldata certificateCID
    ) external onlyRole(Role.Farmer) returns (uint256 batchId) {
        // TODO: check limits, save the batch, add the first history entry, emit BatchRegistered
    }

    // Current holder hands the batch to the next party
    function transferCustody(uint256 batchId, address to)
        external
        batchExists(batchId)
        onlyHolder(batchId)
        whenMovable(batchId)
    {
        // TODO: check the recipient, change the holder, add a history entry, emit CustodyTransferred
    }

    // Current holder moves the batch to the next status
    function updateStatus(uint256 batchId, Status newStatus)
        external
        batchExists(batchId)
        onlyHolder(batchId)
        whenMovable(batchId)
    {
        // TODO: make sure status moves forward, save it, add a history entry, emit StatusUpdated
    }

    // ---- Regulator recall ----

    // A regulator can recall any batch no matter who holds it.
    // Recalls are permanent (whenMovable blocks the batch afterwards).
    function recallBatch(uint256 batchId, string calldata reason)
        external
        onlyRole(Role.Regulator)
        batchExists(batchId)
    {
        Batch storage batch = batches[batchId];
        if (batch.recalled) revert BatchIsRecalled(batchId);   // can't recall twice
        batch.recalled = true;
        emit BatchRecalled(batchId, msg.sender, reason);
    }

    // ---- Sensor readings ----

    // Sensor posts a summary of its readings. We only store the min/max and the
    // log hash on-chain to keep gas low. If the min or max is outside the
    // farmer's range the batch gets flagged. The flag stays on, so the batch
    // can't move and the regulator can recall it.
    function recordReadings(uint256 batchId, int32 minValue, int32 maxValue, bytes32 logHash)
        external
        onlyRole(Role.Sensor)
        batchExists(batchId)
    {
        if (minValue > maxValue) revert InvalidReadings();
        Batch storage batch = batches[batchId];
        if (batch.recalled) revert BatchIsRecalled(batchId);   // no point recording after a recall

        // check against the farmer's safe range and save the reading
        bool withinLimits = minValue >= batch.minLimit && maxValue <= batch.maxLimit;
        readings[batchId].push(Reading(minValue, maxValue, logHash, withinLimits, uint64(block.timestamp)));
        emit ReadingsRecorded(batchId, minValue, maxValue, logHash);

        // out of range -> flag the batch
        if (!withinLimits) {
            batch.flagged = true;
            emit BatchFlagged(batchId, minValue, maxValue);
        }
    }

    // ---- Views ----

    function getBatch(uint256 batchId) external view batchExists(batchId) returns (Batch memory) {
        // TODO: return batches[batchId]
    }

    // Who held the batch and when, oldest first
    function getHistory(uint256 batchId) external view batchExists(batchId) returns (TraceRecord[] memory) {
        // TODO: return histories[batchId]
    }

    function getReadings(uint256 batchId) external view batchExists(batchId) returns (Reading[] memory) {
        return readings[batchId];
    }
}
