// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IFreshTrace
/// @notice Interface for the FreshTrace contract. The web UI, sensor script and
/// tests all use the types, events and functions defined here.
/// Sensor readings and limits are stored x10 so we can keep one decimal
/// place without floats (4.5 C is stored as 45).
interface IFreshTrace {
    // ---- Types ----

    // One role per wallet. Customers don't have a role, they only read data.
    enum Role { None, Farmer, Packer, Carrier, DistributionCenter, Retailer, Regulator, Sensor }

    // A batch can only move forward through these.
    enum Status { Harvested, Packed, InTransit, AtDistributionCenter, AtRetailer }

    // Everything we store about one batch
    struct Batch {
        uint256 id;
        string product;          // ex. "Romaine lettuce"
        uint32 quantityKg;
        address farmer;          // who registered it
        address currentHolder;   // only the holder can transfer or update status
        Status status;
        int32 minLimit;          // safe range set by the farmer
        int32 maxLimit;
        bool flagged;            // set when a reading goes out of range
        bool recalled;           // set by a regulator
        string certificateCID;   // IPFS CID of the certificate
        uint64 createdAt;
    }

    // One step in a batch's history (who had it and at what status).
    // The customer page shows these as the batch's journey.
    struct TraceRecord {
        address holder;
        Status status;
        uint64 timestamp;
    }

    // Summary of one set of sensor readings. The full log is kept off-chain
    // and only its hash is stored, so anyone can check it wasn't changed.
    struct Reading {
        int32 minValue;
        int32 maxValue;
        bytes32 logHash;
        bool withinLimits;
        uint64 timestamp;
    }

    // ---- Events ----
    // The UI listens to these to show what happened to a batch.

    event RoleAssigned(address indexed account, Role role);
    event BatchRegistered(uint256 indexed batchId, address indexed farmer, string product, string certificateCID);
    event CustodyTransferred(uint256 indexed batchId, address indexed from, address indexed to);
    event StatusUpdated(uint256 indexed batchId, Status status);
    event ReadingsRecorded(uint256 indexed batchId, int32 minValue, int32 maxValue, bytes32 logHash);
    event BatchFlagged(uint256 indexed batchId, int32 minValue, int32 maxValue);   // reading out of range
    event BatchRecalled(uint256 indexed batchId, address indexed regulator, string reason);

    // ---- Errors ----

    error NotAdmin();                            // only the admin can assign roles
    error WrongRole(Role required, Role actual); // caller doesn't have the needed role
    error NotCurrentHolder();                    // only the holder can move the batch
    error BatchNotFound(uint256 batchId);
    error BatchIsFlagged(uint256 batchId);       // flagged batches can't move
    error BatchIsRecalled(uint256 batchId);      // recalled batches can't move
    error InvalidLimits();                       // minLimit must be lower than maxLimit
    error InvalidReadings();                     // minValue is greater than maxValue
    error InvalidRecipient();                    // sending to yourself or to a wallet that can't hold batches
    error StatusCannotGoBack();                  // status has to move forward

    // ---- Admin ----

    /// @notice Admin (the deployer) sets a wallet's role. Role.None removes it.
    function setRole(address account, Role role) external;

    /// @notice Returns the role of a wallet (Role.None if it has none).
    function roleOf(address account) external view returns (Role);

    // ---- Supply chain actions ----

    /// @notice Farmer registers a new batch. The farmer becomes the first holder
    /// and the status starts at Harvested.
    function registerBatch(
        string calldata product,
        uint32 quantityKg,
        int32 minLimit,
        int32 maxLimit,
        string calldata certificateCID
    ) external returns (uint256 batchId);

    /// @notice Current holder passes the batch to the next party.
    /// Not allowed if the batch is flagged or recalled.
    function transferCustody(uint256 batchId, address to) external;

    /// @notice Current holder moves the batch to a later status.
    /// Not allowed if the batch is flagged or recalled.
    function updateStatus(uint256 batchId, Status newStatus) external;

    /// @notice Sensor posts the min and max of a set of readings and a hash of
    /// the full log. If either value is outside the safe range the batch is flagged.
    function recordReadings(uint256 batchId, int32 minValue, int32 maxValue, bytes32 logHash) external;

    /// @notice Regulator recalls a batch. After this it can't move anymore.
    function recallBatch(uint256 batchId, string calldata reason) external;

    // ---- Read functions (customer page uses these, no wallet needed) ----

    /// @notice How many batches exist. IDs go from 1 to batchCount.
    function batchCount() external view returns (uint256);

    /// @notice Current details of a batch (holder, status, flag, recall, CID).
    function getBatch(uint256 batchId) external view returns (Batch memory);

    /// @notice Full custody and status history of a batch, oldest first.
    function getHistory(uint256 batchId) external view returns (TraceRecord[] memory);

    /// @notice All sensor reading summaries for a batch, oldest first.
    function getReadings(uint256 batchId) external view returns (Reading[] memory);
}
