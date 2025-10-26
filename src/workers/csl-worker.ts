// src/workers/csl-worker.ts
// Real CSL-based transaction parser

import * as CSL from '@emurgo/cardano-serialization-lib-asmjs';

let isInitialized = false;

// Initialize CSL parser
async function initializeParser() {
  if (isInitialized) return;
  
  try {
    // CSL is already initialized when imported
    isInitialized = true;
    console.log('CSL transaction parser initialized successfully');
  } catch (error) {
    console.error('Failed to initialize CSL parser:', error);
    throw error;
  }
}

// Enhanced metadata parsing helper functions
function parseMetadatum(metadatum: any): any {
  const kind = metadatum.kind();
  
  switch (kind) {
    case 0: // Text
      return metadatum.as_text();
    case 1: // Int
      return metadatum.as_int().to_str();
    case 2: // Bytes
      return Array.from(metadatum.as_bytes()).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join('');
    case 3: // List
      return parseMetadataList(metadatum.as_list());
    case 4: // Map
      return parseMetadataMap(metadatum.as_map());
    default:
      return null;
  }
}

function parseMetadataList(list: any): any[] {
  const result = [];
  for (let i = 0; i < list.len(); i++) {
    result.push(parseMetadatum(list.get(i)));
  }
  return result;
}

function parseMetadataMap(map: any): Record<string, any> {
  const result: Record<string, any> = {};
  const keys = map.keys();
  for (let i = 0; i < keys.len(); i++) {
    const key = parseMetadatum(keys.get(i));
    const value = parseMetadatum(map.get(keys.get(i)));
    result[String(key)] = value;
  }
  return result;
}

function getMetadatumType(metadatum: any): string {
  const kind = metadatum.kind();
  const types = ['text', 'int', 'bytes', 'list', 'map'];
  return types[kind] || 'unknown';
}

// Enhanced datum parsing helper functions
function getDatumType(plutusData: any): string {
  try {
    const kind = plutusData.kind();
    const types = ['constr', 'map', 'list', 'int', 'bytes'];
    return types[kind] || 'unknown';
  } catch {
    return 'unknown';
  }
}

function parseDatumContent(plutusData: any): any {
  try {
    const kind = plutusData.kind();
    
    switch (kind) {
      case 0: // Constr
        return {
          constructor: plutusData.as_constr()?.constr_index() || 0,
          fields: plutusData.as_constr()?.fields() ? 
            Array.from({ length: plutusData.as_constr().fields().len() }, (_, i) => 
              parseDatumContent(plutusData.as_constr().fields().get(i))
            ) : []
        };
      case 1: // Map
        return parseDatumMap(plutusData.as_map());
      case 2: // List
        return parseDatumList(plutusData.as_list());
      case 3: // Int
        return plutusData.as_int().to_str();
      case 4: // Bytes
        return Array.from(plutusData.as_bytes()).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join('');
      default:
        return null;
    }
  } catch (error) {
    console.warn('Error parsing datum content:', error);
    return null;
  }
}

function parseDatumList(list: any): any[] {
  const result = [];
  for (let i = 0; i < list.len(); i++) {
    result.push(parseDatumContent(list.get(i)));
  }
  return result;
}

function parseDatumMap(map: any): Record<string, any> {
  const result: Record<string, any> = {};
  const keys = map.keys();
  for (let i = 0; i < keys.len(); i++) {
    const key = parseDatumContent(keys.get(i));
    const value = parseDatumContent(map.get(keys.get(i)));
    result[String(key)] = value;
  }
  return result;
}

// Real CSL-based transaction parsing
async function parseTransaction(hex: string) {
  let transaction: any = null;
  let body: any = null;
  let witnessSet: any = null;
  let auxiliaryData: any = null;
  
  try {
    await initializeParser();
    
    // Enhanced validation
    if (!hex || typeof hex !== 'string') {
      throw new Error('Transaction hex is required and must be a string');
    }
    
    if (hex.length < 100) {
      throw new Error('Transaction hex too short to be valid (minimum 100 characters)');
    }
    
    if (hex.length > 1000000) {
      throw new Error('Transaction hex too long (maximum 1MB)');
    }
    
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex format - only hexadecimal characters allowed');
    }
    
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    // Check for common prefixes and clean if needed
    const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
    if (cleanHex !== hex) {
      console.warn('Removed 0x prefix from transaction hex');
    }
    
    // Parse transaction using CSL
    transaction = CSL.Transaction.from_hex(cleanHex);
    body = transaction.body();
    witnessSet = transaction.witness_set();
    auxiliaryData = transaction.auxiliary_data();
    
    // Validate transaction structure
    if (!body) {
      throw new Error('Failed to parse transaction body');
    }
    
    if (!witnessSet) {
      throw new Error('Failed to parse witness set');
    }
    
    // Get transaction size
    const size = hex.length / 2;
    
    // Calculate transaction ID (hash of the body)
    const fixedTransaction = CSL.FixedTransaction.from_hex(hex);
    const id = fixedTransaction.transaction_hash().to_hex();
    
    // Determine era based on transaction structure
    let era = "Unknown";
    try {
      // Check for Conway era features first
      if (body.voting_procedures() !== undefined || body.voting_proposals() !== undefined) {
        era = "Conway";
      } else if (body.script_data_hash() !== undefined) {
      era = "Babbage";
      } else if (body.mint() !== undefined) {
      era = "Alonzo";
      } else {
        era = "Alonzo"; // Default to Alonzo for now
      }
    } catch {
      era = "Unknown";
    }
    
    // Parse fee
    const fee = BigInt(body.fee().to_str());
    
    // Parse TTL
    const ttlBignum = body.ttl_bignum();
    const ttl = ttlBignum ? Number(ttlBignum.to_str()) : null;
    
    // Parse validity interval
    const validityStartBignum = body.validity_start_interval_bignum();
    const validityStart = validityStartBignum ? Number(validityStartBignum.to_str()) : null;
    
    // Parse inputs
    const inputs = [];
    const bodyInputs = body.inputs();
    for (let i = 0; i < bodyInputs.len(); i++) {
      const input = bodyInputs.get(i);
      const txId = input.transaction_id().to_hex();
      const index = input.index();
      
      inputs.push({
        txId,
        index,
        isCollateral: false, // Regular inputs are not collateral
        resolved: undefined // Will be resolved later if needed
      });
    }
    
    // Parse collateral inputs
    const collateralInputs = body.collateral();
    if (collateralInputs) {
      for (let i = 0; i < collateralInputs.len(); i++) {
        const input = collateralInputs.get(i);
        const txId = input.transaction_id().to_hex();
        const index = input.index();
        
        inputs.push({
          txId,
          index,
          isCollateral: true,
          resolved: undefined
        });
      }
    }
    
    // Parse outputs
    const outputs = [];
    const bodyOutputs = body.outputs();
    for (let i = 0; i < bodyOutputs.len(); i++) {
      const output = bodyOutputs.get(i);
      const address = output.address().to_bech32();
      const amount = output.amount();
      
      // Parse ADA amount
      const ada = BigInt(amount.coin().to_str());
      
      // Parse assets
      const assets = [];
      const multiAsset = amount.multiasset();
      if (multiAsset) {
        const keys = multiAsset.keys();
        for (let j = 0; j < keys.len(); j++) {
          const policyId = keys.get(j).to_hex();
          const assetsMap = multiAsset.get(keys.get(j));
          if (assetsMap) {
            const assetNames = assetsMap.keys();
            
            for (let k = 0; k < assetNames.len(); k++) {
              const assetName = assetNames.get(k).to_hex();
              const quantity = BigInt(assetsMap.get(assetNames.get(k))?.to_str() || '0');
              
              assets.push({
                policyId,
                assetName,
                quantity
              });
            }
          }
        }
      }
      
      // Parse datum with enhanced detection
      let datum = undefined;
      const dataHash = output.data_hash();
      const plutusData = output.plutus_data();
      
      if (plutusData) {
        // Inline datum - try to parse the content
        try {
          const datumType = getDatumType(plutusData);
          const datumContent = parseDatumContent(plutusData);
          
          datum = {
            inline: true,
            hash: dataHash?.to_hex() || undefined,
            type: datumType,
            content: datumContent,
            size: plutusData.to_bytes().length
          };
        } catch (error) {
          console.warn('Error parsing inline datum:', error);
          datum = {
            inline: true,
            hash: dataHash?.to_hex() || undefined,
            type: 'unknown',
            content: null,
            error: error instanceof Error ? error.message : 'Parse error'
          };
        }
      } else if (dataHash) {
        // Datum hash
        datum = {
          inline: false,
          hash: dataHash.to_hex(),
          type: 'hash',
          content: null
        };
      }
      
      // Parse script reference
      let scriptRef = undefined;
      const scriptRefOption = output.script_ref();
      if (scriptRefOption) {
        if (scriptRefOption.is_native_script()) {
          const nativeScript = scriptRefOption.native_script();
          if (nativeScript) {
            scriptRef = {
              type: "Native",
              bytes: nativeScript.to_hex()
            };
          }
        } else if (scriptRefOption.is_plutus_script()) {
          const plutusScript = scriptRefOption.plutus_script();
          if (plutusScript) {
            const version = plutusScript.language_version();
            const type = version.kind() === 0 ? "PlutusV1" : 
                        version.kind() === 1 ? "PlutusV2" : 
                        version.kind() === 2 ? "PlutusV3" : "PlutusV1";
            scriptRef = {
              type,
              bytes: plutusScript.to_hex()
            };
          }
        }
      }
      
      outputs.push({
        address,
        ada,
        assets,
        datum,
        scriptRef
      });
    }
    
    // Parse mint
    let mint = undefined;
    const mintData = body.mint();
    if (mintData) {
      mint = [];
      const keys = mintData.keys();
      for (let i = 0; i < keys.len(); i++) {
        const policyId = keys.get(i).to_hex();
        const mintsAssets = mintData.get(keys.get(i));
        if (mintsAssets) {
          // MintsAssets is a collection of MintAssets
          for (let j = 0; j < mintsAssets.len(); j++) {
            const mintAssets = mintsAssets.get(j);
            if (mintAssets) {
              const assetNames = mintAssets.keys();
              
              for (let k = 0; k < assetNames.len(); k++) {
                const assetName = assetNames.get(k).to_hex();
                const quantity = BigInt(mintAssets.get(assetNames.get(k))?.to_str() || '0');
                
                mint.push({
                  policyId,
                  assetName,
                  quantity
                });
              }
            }
          }
        }
      }
    }
    
    // Parse certificates
    let certs = undefined;
    const bodyCerts = body.certs();
    if (bodyCerts) {
      certs = [];
      for (let i = 0; i < bodyCerts.len(); i++) {
        const cert = bodyCerts.get(i);
        // Parse certificate type and details
        const certType = cert.kind();
        let type = "Unknown";
        let details: Record<string, unknown> = {};
        
        try {
          // Try to parse certificate as JSON first to get the actual structure
          const certJson = cert.to_js_value();
          
          if (certJson.StakeRegistration) {
            type = "StakeRegistration";
            const stakeReg = certJson.StakeRegistration;
            details = {
              stakeCredential: {
                type: stakeReg.stake_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: stakeReg.stake_credential?.Key || stakeReg.stake_credential?.Script || "",
                bech32: stakeReg.stake_credential?.Key || stakeReg.stake_credential?.Script || ""
              },
              coin: stakeReg.coin || "0",
              deposit: stakeReg.coin || "0"
            };
          } else if (certJson.StakeDeregistration) {
            type = "StakeDeregistration";
            const stakeDereg = certJson.StakeDeregistration;
            details = {
              stakeCredential: {
                type: stakeDereg.stake_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: stakeDereg.stake_credential?.Key || stakeDereg.stake_credential?.Script || "",
                bech32: stakeDereg.stake_credential?.Key || stakeDereg.stake_credential?.Script || ""
              },
              coin: stakeDereg.coin || "0",
              refund: stakeDereg.coin || "0"
            };
          } else if (certJson.StakeDelegation) {
            type = "StakeDelegation";
            const stakeDeleg = certJson.StakeDelegation;
            details = {
              stakeCredential: {
                type: stakeDeleg.stake_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: stakeDeleg.stake_credential?.Key || stakeDeleg.stake_credential?.Script || "",
                bech32: stakeDeleg.stake_credential?.Key || stakeDeleg.stake_credential?.Script || ""
              },
              poolKeyHash: stakeDeleg.pool_keyhash || "",
              poolId: stakeDeleg.pool_keyhash || ""
            };
          } else if (certJson.PoolRegistration) {
            type = "PoolRegistration";
            const poolReg = certJson.PoolRegistration;
            details = {
              operator: {
                type: "KeyHash",
                hash: poolReg.operator || "",
                bech32: poolReg.operator || ""
              },
              vrfKeyHash: {
                type: "VRFKeyHash",
                hash: poolReg.vrf_keyhash || ""
              },
              pledge: poolReg.pledge || "0",
              cost: poolReg.cost || "0",
              margin: poolReg.margin || {},
              rewardAccount: {
                address: poolReg.reward_account || "",
                credential: {
                  type: "KeyHash",
                  hash: poolReg.reward_account || ""
                }
              },
              poolOwners: poolReg.pool_owners || [],
              relays: poolReg.relays || [],
              poolId: poolReg.operator || ""
            };
          } else if (certJson.PoolRetirement) {
            type = "PoolRetirement";
            const poolRet = certJson.PoolRetirement;
            details = {
              poolOperator: {
                type: "KeyHash",
                hash: poolRet.pool_keyhash || "",
                bech32: poolRet.pool_keyhash || ""
              },
              epoch: poolRet.epoch || 0,
              poolId: poolRet.pool_keyhash || ""
            };
          } else if (certJson.GenesisKeyDelegation) {
            type = "GenesisKeyDelegation";
            const genesisDeleg = certJson.GenesisKeyDelegation;
            details = {
              genesisHash: {
                type: "GenesisKeyHash",
                hash: genesisDeleg.genesishash || ""
              },
              genesisDelegateHash: {
                type: "GenesisDelegateHash",
                hash: genesisDeleg.genesis_delegate_hash || ""
              },
              vrfKeyHash: {
                type: "VRFKeyHash",
                hash: genesisDeleg.vrf_keyhash || ""
              }
            };
          } else if (certJson.VoteDelegation) {
            console.log('VoteDelegation', certJson.VoteDelegation);
            type = "VoteDelegation";
            const voteDeleg = certJson.VoteDelegation;
            details = {
              stakeCredential: {
                type: voteDeleg.stake_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: voteDeleg.stake_credential?.Key || voteDeleg.stake_credential?.Script || "",
                bech32: voteDeleg.stake_credential?.Key || voteDeleg.stake_credential?.Script || ""
              },
              drepCredential: {
                type: voteDeleg.drep?.KeyHash ? "KeyHash" : "ScriptHash",
                hash: voteDeleg.drep?.KeyHash || voteDeleg.drep?.ScriptHash || "",
                bech32: voteDeleg.drep?.KeyHash || voteDeleg.drep?.ScriptHash || ""
              },
              drepId: voteDeleg.drep?.KeyHash || voteDeleg.drep?.ScriptHash || ""
            };
            console.log('VoteDelegation details', details);
          } else if (certJson.DRepRegistration) {
            type = "DRepRegistration";
            const drepReg = certJson.DRepRegistration;
            details = {
              drepCredential: {
                type: drepReg.drep_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: drepReg.drep_credential?.Key || drepReg.drep_credential?.Script || "",
                bech32: drepReg.drep_credential?.Key || drepReg.drep_credential?.Script || ""
              },
              coin: drepReg.coin || "0",
              deposit: drepReg.coin || "0",
              drepId: drepReg.drep_credential?.Key || drepReg.drep_credential?.Script || ""
            };
          } else if (certJson.DRepDeregistration) {
            type = "DRepDeregistration";
            const drepDereg = certJson.DRepDeregistration;
            details = {
              drepCredential: {
                type: drepDereg.drep_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: drepDereg.drep_credential?.Key || drepDereg.drep_credential?.Script || "",
                bech32: drepDereg.drep_credential?.Key || drepDereg.drep_credential?.Script || ""
              },
              epoch: drepDereg.epoch || 0,
              drepId: drepDereg.drep_credential?.Key || drepDereg.drep_credential?.Script || ""
            };
          } else if (certJson.DRepUpdate) {
            type = "DRepUpdate";
            const drepUpdate = certJson.DRepUpdate;
            details = {
              drepCredential: {
                type: drepUpdate.drep_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: drepUpdate.drep_credential?.Key || drepUpdate.drep_credential?.Script || "",
                bech32: drepUpdate.drep_credential?.Key || drepUpdate.drep_credential?.Script || ""
              },
              anchor: drepUpdate.anchor || null,
              drepId: drepUpdate.drep_credential?.Key || drepUpdate.drep_credential?.Script || ""
            };
          } else if (certJson.CommitteeHotAuth) {
            type = "CommitteeHotAuth";
            const committeeHot = certJson.CommitteeHotAuth;
            details = {
              hotCredential: {
                type: committeeHot.hot_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: committeeHot.hot_credential?.Key || committeeHot.hot_credential?.Script || "",
                bech32: committeeHot.hot_credential?.Key || committeeHot.hot_credential?.Script || ""
              },
              epoch: committeeHot.epoch || 0,
              committeeMember: committeeHot.hot_credential?.Key || committeeHot.hot_credential?.Script || ""
            };
          } else if (certJson.CommitteeColdResign) {
            type = "CommitteeColdResign";
            const committeeCold = certJson.CommitteeColdResign;
            details = {
              coldCredential: {
                type: committeeCold.cold_credential?.Key ? "KeyHash" : "ScriptHash",
                hash: committeeCold.cold_credential?.Key || committeeCold.cold_credential?.Script || "",
                bech32: committeeCold.cold_credential?.Key || committeeCold.cold_credential?.Script || ""
              },
              epoch: committeeCold.epoch || 0,
              committeeMember: committeeCold.cold_credential?.Key || committeeCold.cold_credential?.Script || ""
            };
          } else {
            // Fallback to original parsing method for unknown certificate types
            type = "Unknown";
            details = { raw: cert.to_hex() };
          }
        } catch (error) {
          console.warn('Error parsing certificate:', error);
          type = "Unknown";
          details = { raw: cert.to_hex() };
        }
        
        certs.push({
          type,
          details
        });
      }
    }
    
    // Parse withdrawals
    let withdrawals = undefined;
    const bodyWithdrawals = body.withdrawals();
    if (bodyWithdrawals) {
      withdrawals = [];
      const keys = bodyWithdrawals.keys();
      for (let i = 0; i < keys.len(); i++) {
        const stakeAddr = keys.get(i).to_address().to_bech32();
        const amount = BigInt(bodyWithdrawals.get(keys.get(i))?.to_str() || '0');
        withdrawals.push({
          stakeAddr,
          amount
        });
      }
    }
    
    // Parse governance data (Conway era)
    let governance: {
      constitution: { hash: string; url?: string } | null;
      committee: { members: Array<{ keyHash: string; epoch: number }>; threshold: number } | null;
      drepVotes: Array<{ drepId: string; action: string; proposalId: string }>;
      committeeVotes: Array<{ memberId: string; action: string; proposalId: string }>;
      proposals: Array<{ id: string; type: string; details: Record<string, unknown> }>;
    } | null = null;
    try {
      const votingProcedures = body.voting_procedures();
      const votingProposals = body.voting_proposals();
      
      if (votingProcedures || votingProposals) {
        governance = {
          constitution: null as { hash: string; url?: string } | null,
          committee: null as { members: Array<{ keyHash: string; epoch: number }>; threshold: number } | null,
          drepVotes: [] as Array<{ drepId: string; action: string; proposalId: string }>,
          committeeVotes: [] as Array<{ memberId: string; action: string; proposalId: string }>,
          proposals: [] as Array<{ id: string; type: string; details: Record<string, unknown> }>
        };
        
        // Parse voting procedures if available
        if (votingProcedures) {
          try {
            // Try to parse voting procedures
            const procedures = votingProcedures.to_js_value();
            if (Array.isArray(procedures)) {
              procedures.forEach((procedure: any) => {
                if (procedure.voter && procedure.votes && Array.isArray(procedure.votes)) {
                  // Determine voter type
                  const voterType = procedure.voter.ConstitutionalCommitteeHotCred ? 'committee' : 
                                  procedure.voter.DRep ? 'drep' : 
                                  procedure.voter.StakingPool ? 'pool' : 'unknown';
                  
                  // Process each vote
                  procedure.votes.forEach((vote: any) => {
                    if (vote.action_id && vote.voting_procedure) {
                      const proposalId = `${vote.action_id.transaction_id}${vote.action_id.index}`;
                      const voteAction = vote.voting_procedure.vote;
                      
                      // Map vote action to our format
                      let action = 'Unknown';
                      if (voteAction === 'Yes') action = 'VoteYes';
                      else if (voteAction === 'No') action = 'VoteNo';
                      else if (voteAction === 'Abstain') action = 'Abstain';
                      
                      if (voterType === 'drep' && governance) {
                        governance.drepVotes.push({
                          drepId: procedure.voter.DRep?.Key || procedure.voter.DRep || '',
                          action: action,
                          proposalId: proposalId
                        });
                      } else if (voterType === 'committee' && governance) {
                        governance.committeeVotes.push({
                          memberId: procedure.voter.ConstitutionalCommitteeHotCred?.Key || procedure.voter.ConstitutionalCommitteeHotCred || '',
                          action: action,
                          proposalId: proposalId
                        });
                      }
                    }
                  });
                }
              });
            }
          } catch (error) {
            console.warn('Error parsing voting procedures:', error);
          }
        }
        
        // Parse voting proposals if available
        if (votingProposals) {
          try {
            // Try to parse voting proposals
            const proposals = votingProposals.to_js_value();
            if (Array.isArray(proposals)) {
              proposals.forEach((proposal: any) => {
                let proposalType = 'Unknown';
                let details: Record<string, unknown> = {};
                
                // Extract proposal ID from action_id if available
                let proposalId = '';
                if (proposal.action_id) {
                  proposalId = `${proposal.action_id.transaction_id}${proposal.action_id.index}`;
                } else if (proposal.governance_action_id) {
                  proposalId = proposal.governance_action_id;
                }
                
                // Determine proposal type based on governance action
                if (proposal.governance_action) {
                  const action = proposal.governance_action;
                  
                  if (action.ParameterChange) {
                    proposalType = 'ParameterChange';
                    details = {
                      parameterChanges: action.ParameterChange.parameter_changes || {},
                      epoch: action.ParameterChange.epoch || null
                    };
                  } else if (action.HardForkInitiation) {
                    proposalType = 'HardForkInitiation';
                    details = {
                      epoch: action.HardForkInitiation.epoch || null,
                      protocolVersion: action.HardForkInitiation.protocol_version || null
                    };
                  } else if (action.TreasuryWithdrawals) {
                    proposalType = 'TreasuryWithdrawals';
                    details = {
                      withdrawals: action.TreasuryWithdrawals.withdrawals || [],
                      epoch: action.TreasuryWithdrawals.epoch || null
                    };
                  } else if (action.NoConfidence) {
                    proposalType = 'NoConfidence';
                    details = {
                      epoch: action.NoConfidence.epoch || null
                    };
                  } else if (action.NewConstitution) {
                    proposalType = 'NewConstitution';
                    details = {
                      constitution: action.NewConstitution.constitution || null,
                      epoch: action.NewConstitution.epoch || null
                    };
                  } else if (action.InfoAction) {
                    proposalType = 'InfoAction';
                    details = {
                      info: action.InfoAction.info || null
                    };
                  }
                }
                
                if (governance) {
                  governance.proposals.push({
                    id: proposalId,
                    type: proposalType,
                    details: {
                      ...details,
                      raw: proposal
                    }
                  });
                }
              });
            }
          } catch (error) {
            console.warn('Error parsing voting proposals:', error);
          }
        }
        
        // Try to extract constitution from metadata if available
        if (auxiliaryData) {
          try {
            const metadataMap = auxiliaryData.metadata();
            if (metadataMap) {
              const keys = metadataMap.keys();
              for (let i = 0; i < keys.len(); i++) {
                const label = keys.get(i).to_str();
                if (label === '61284') { // Constitution metadata label
                  const metadatum = metadataMap.get(keys.get(i));
                  if (metadatum) {
                    try {
                      // Try to parse as text first
                      const constitutionText = metadatum.as_text();
                      if (constitutionText) {
                        governance.constitution = {
                          hash: constitutionText,
                          url: ''
                        };
                      }
                    } catch {
                      // If not text, try to parse as bytes
                      try {
                        const constitutionBytes = metadatum.as_bytes();
                        if (constitutionBytes) {
                          governance.constitution = {
                            hash: Array.from(constitutionBytes).map((b: unknown) => (b as number).toString(16).padStart(2, '0')).join(''),
                            url: ''
                          };
                        }
                      } catch {
                        // Fallback to hex representation
                        governance.constitution = {
                          hash: metadatum.to_hex(),
                          url: ''
                        };
                      }
                    }
                  }
                }
              }
            }
          } catch (error) {
            console.warn('Error parsing constitution from metadata:', error);
          }
        }
        
        // Try to extract committee information from certificates
        if (certs) {
          const committeeCerts = certs.filter(cert => 
            cert.type === 'CommitteeHotAuth' || 
            cert.type === 'CommitteeColdResign'
          );
          
          if (committeeCerts.length > 0) {
            governance.committee = {
              members: committeeCerts.map(cert => ({
                keyHash: (cert.details as any).keyHash || '',
                epoch: (cert.details as any).epoch || 0
              })),
              threshold: 0 // Would need to be extracted from protocol parameters
            };
          }
        }
      }
    } catch (error) {
      console.warn('Error parsing governance data:', error);
      // Governance parsing is optional, so we don't throw
    }
    
    // Parse metadata with enhanced handling
    const metadata = [];
    if (auxiliaryData) {
      const metadataMap = auxiliaryData.metadata();
      if (metadataMap) {
        const keys = metadataMap.keys();
        for (let i = 0; i < keys.len(); i++) {
          const label = keys.get(i).to_str();
          const metadatum = metadataMap.get(keys.get(i));
          
          if (metadatum) {
            try {
              const parsedData = parseMetadatum(metadatum);
              metadata.push({
                label,
                json: parsedData,
                cbor: metadatum.to_hex(),
                type: getMetadatumType(metadatum)
              });
            } catch (error) {
              console.warn(`Error parsing metadata label ${label}:`, error);
      metadata.push({
                label,
                json: null,
                cbor: metadatum.to_hex(),
                type: 'unknown',
                error: error instanceof Error ? error.message : 'Parse error'
              });
            }
          }
        }
      }
    }
    
    // Parse script data hash and total collateral
    const scriptDataHash = body.script_data_hash()?.to_hex();
    const totalCollateral = body.total_collateral()?.to_str();
    
    // Parse collateral return
    let collateralReturn = undefined;
    const collateralReturnOutput = body.collateral_return();
    if (collateralReturnOutput) {
      const address = collateralReturnOutput.address().to_bech32();
      const amount = collateralReturnOutput.amount();
      const ada = amount.coin();
      const assets = [];
      
      const multiasset = amount.multiasset();
      if (multiasset) {
        const policies = multiasset.keys();
        for (let i = 0; i < policies.len(); i++) {
          const policy = policies.get(i);
          const policyId = policy.to_hex();
          const assetsMap = multiasset.get(policy);
          const assetNames = assetsMap.keys();
          
          for (let j = 0; j < assetNames.len(); j++) {
            const assetName = assetNames.get(j);
            const quantity = assetsMap.get(assetName);
            assets.push({
              policyId,
              assetName: assetName.to_hex(),
              quantity: BigInt(quantity.to_str())
            });
          }
        }
      }
      
      collateralReturn = {
        address,
        ada: BigInt(ada.to_str()),
        assets
      };
    }
    
    // Parse reference inputs
    const referenceInputs = [];
    const refInputs = body.reference_inputs();
    if (refInputs) {
      for (let i = 0; i < refInputs.len(); i++) {
        const refInput = refInputs.get(i);
        referenceInputs.push({
          txId: refInput.transaction_id().to_hex(),
          index: refInput.index()
        });
      }
    }
    
    // Parse scripts and redeemers
    const scripts = [];
    const redeemers = [];
    
    // Native scripts
    const nativeScripts = witnessSet.native_scripts();
    if (nativeScripts) {
      for (let i = 0; i < nativeScripts.len(); i++) {
        const script = nativeScripts.get(i);
        scripts.push({
          type: "Native",
          hash: script.hash().to_hex(),
          bytesLen: script.to_bytes().length
        });
      }
    }
    
    // Plutus scripts
    const plutusScripts = witnessSet.plutus_scripts();
    if (plutusScripts) {
      for (let i = 0; i < plutusScripts.len(); i++) {
        const script = plutusScripts.get(i);
        const version = script.language_version();
        const type = version.kind() === 0 ? "PlutusV1" : 
                    version.kind() === 1 ? "PlutusV2" : 
                    version.kind() === 2 ? "PlutusV3" : "PlutusV1";
        
        scripts.push({
          type,
          hash: script.hash().to_hex(),
          bytesLen: script.to_bytes().length
        });
      }
    }
    
    // Redeemers
    const witnessRedeemers = witnessSet.redeemers();
    if (witnessRedeemers) {
      for (let i = 0; i < witnessRedeemers.len(); i++) {
        const redeemer = witnessRedeemers.get(i);
        const purpose = redeemer.tag().kind() === 0 ? "spend" :
                       redeemer.tag().kind() === 1 ? "mint" :
                       redeemer.tag().kind() === 2 ? "cert" :
                       redeemer.tag().kind() === 3 ? "reward" : "unknown";
        
        redeemers.push({
          purpose,
          index: redeemer.index(),
          exUnits: {
            mem: redeemer.ex_units().mem(),
            steps: redeemer.ex_units().steps()
          },
          data: redeemer.data()?.to_hex() || undefined,
          scriptHash: undefined // This would need to be associated with the corresponding script
        });
      }
    }
    
    // Count witnesses and extract signer details
    const vkeyCount = witnessSet.vkeys()?.len() || 0;
    const nativeCount = witnessSet.native_scripts()?.len() || 0;
    const plutusCount = witnessSet.plutus_scripts()?.len() || 0;
    
    // Extract detailed signer information
    const signers = [];
    
    // Get required signers from transaction body
    const requiredSigners = body.required_signers();
    if (requiredSigners) {
      for (let i = 0; i < requiredSigners.len(); i++) {
        const keyHash = requiredSigners.get(i);
        try {
          const hash = keyHash.to_hex();
          signers.push({
            type: 'vkey' as const,
            hash,
            address: undefined,
            isWitness: false,
            isRequired: true
          });
        } catch (error) {
          console.warn('Error extracting required signer:', error);
        }
      }
    }
    
    // Get actual VKey witnesses (signatures provided)
    const vkeys = witnessSet.vkeys();
    if (vkeys) {
      for (let i = 0; i < vkeys.len(); i++) {
        const vkey = vkeys.get(i);
        try {
          const hash = vkey.hash().to_hex();
          // Check if this witness corresponds to a required signer
          const isRequired = requiredSigners ? 
            Array.from({ length: requiredSigners.len() }, (_, j) => requiredSigners.get(j).to_hex()).includes(hash) : 
            false;
          
          signers.push({
            type: 'vkey' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired
          });
        } catch (error) {
          console.warn('Error extracting vkey witness:', error);
        }
      }
    }
    
    // Native script witnesses
    if (nativeScripts) {
      for (let i = 0; i < nativeScripts.len(); i++) {
        const script = nativeScripts.get(i);
        try {
          const hash = script.hash().to_hex();
          signers.push({
            type: 'native' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired: false
          });
        } catch (error) {
          console.warn('Error extracting native script witness:', error);
        }
      }
    }
    
    // Plutus script witnesses
    if (plutusScripts) {
      for (let i = 0; i < plutusScripts.len(); i++) {
        const script = plutusScripts.get(i);
        try {
          const hash = script.hash().to_hex();
          signers.push({
            type: 'plutus' as const,
            hash,
            address: undefined,
            isWitness: true,
            isRequired: false
          });
        } catch (error) {
          console.warn('Error extracting plutus script witness:', error);
        }
      }
    }
    
    // Enhanced validation and warnings
    const warnings: string[] = [];
    const validation = {
      isValid: true,
      errors: [] as string[],
      warnings: [] as string[]
    };
    
    // Size validation
    if (size > 16384) {
      warnings.push("Transaction size exceeds recommended limit");
      validation.warnings.push("Large transaction size may impact network performance");
    }
    
    // Basic structure validation
    if (inputs.length === 0) {
      warnings.push("No inputs found in transaction");
      validation.errors.push("Transaction must have at least one input");
      validation.isValid = false;
    }
    
    if (outputs.length === 0) {
      warnings.push("No outputs found in transaction");
      validation.errors.push("Transaction must have at least one output");
      validation.isValid = false;
    }
    
    // Fee validation
    if (fee < 0n) {
      validation.errors.push("Transaction fee cannot be negative");
      validation.isValid = false;
    }
    
    // TTL validation
    if (ttl && ttl < 0) {
      validation.errors.push("TTL cannot be negative");
      validation.isValid = false;
    }
    
    // Validity interval validation
    if (validityStart && ttl && validityStart >= ttl) {
      validation.errors.push("Validity start must be before TTL");
      validation.isValid = false;
    }
    
    // Input/Output consistency
    const totalInputValue = inputs.reduce((sum, input) => {
      // This would need actual UTXO resolution to be accurate
      return sum;
    }, 0n);
    
    const totalOutputValue = outputs.reduce((sum, output) => {
      return sum + output.ada;
    }, 0n);
    
    // Check for potential dust outputs
    outputs.forEach((output, index) => {
      if (output.ada < 1000000n) { // Less than 1 ADA
        validation.warnings.push(`Output ${index} may be dust (${output.ada} lovelace)`);
      }
    });
    
    // Script validation
    if (scripts.length > 0 && redeemers.length === 0) {
      validation.warnings.push("Scripts present but no redeemers found");
    }
    
    // Governance validation
    if (governance) {
      if (governance.drepVotes.length > 0 && governance.proposals.length === 0) {
        validation.warnings.push("DRep votes present but no governance proposals found");
      }
    }
    
    // Clean up CSL objects
    if (transaction) transaction.free();
    if (body) body.free();
    if (witnessSet) witnessSet.free();
    if (auxiliaryData) auxiliaryData.free();
    
    return {
      success: true,
      tx: {
        era,
        id,
        sizeBytes: size,
        feeLovelace: fee,
        ttl,
        slot: ttl ? ttl - 1000 : null, // Estimate slot
        validity: { start: validityStart, end: ttl },
        inputs,
        outputs,
        mint,
        certs,
        withdrawals,
        governance,
        metadata,
        scripts,
        redeemers,
        witnesses: { vkeyCount, nativeCount, plutusCount },
        signers,
        scriptDataHash,
        totalCollateral: totalCollateral ? BigInt(totalCollateral) : undefined,
        collateralReturn,
        referenceInputs,
        warnings,
        validation,
        stats: {
          inputCount: inputs.length,
          outputCount: outputs.length,
          assetCount: outputs.reduce((sum, output) => sum + output.assets.length, 0),
          scriptCount: scripts.length,
          redeemerCount: redeemers.length,
          metadataCount: metadata.length,
          governanceActionCount: governance ? 
            (governance.drepVotes.length + governance.committeeVotes.length + governance.proposals.length) : 0
        }
      },
    };
  } catch (error) {
    console.error('Transaction parsing error:', error);
    
    // Clean up CSL objects on error
    try {
      if (transaction) transaction.free();
      if (body) body.free();
      if (witnessSet) witnessSet.free();
      if (auxiliaryData) auxiliaryData.free();
    } catch (cleanupError) {
      console.warn('Error during cleanup:', cleanupError);
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown parsing error',
      details: error instanceof Error ? error.stack : undefined,
    };
  }
}

// Handle messages from main thread
self.onmessage = async (event) => {
  const { type, data } = event.data;
  
  try {
    switch (type) {
      case 'PARSE_TRANSACTION':
        const result = await parseTransaction(data.hex);
        self.postMessage({ type: 'PARSE_RESULT', data: result });
        break;
      default:
        self.postMessage({ type: 'ERROR', data: { error: 'Unknown message type' } });
    }
  } catch (error) {
    self.postMessage({ 
      type: 'ERROR', 
      data: { 
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error ? error.stack : undefined,
      } 
    });
  }
};
