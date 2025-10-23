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

// Real CSL-based transaction parsing
async function parseTransaction(hex: string) {
  try {
    await initializeParser();
    
    // Basic validation
    if (!hex || hex.length < 100) {
      throw new Error('Transaction hex too short to be valid');
    }
    
    if (!/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error('Invalid hex format');
    }
    
    if (hex.length % 2 !== 0) {
      throw new Error('Hex string must have even length');
    }
    
    // Parse transaction using CSL
    const transaction = CSL.Transaction.from_hex(hex);
    const body = transaction.body();
    const witnessSet = transaction.witness_set();
    const auxiliaryData = transaction.auxiliary_data();
    
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
      
      // Parse datum
      let datum = undefined;
      const dataHash = output.data_hash();
      const plutusData = output.plutus_data();
      
      if (plutusData) {
        // Inline datum
        datum = {
          inline: true,
          hash: dataHash?.to_hex() || undefined
        };
      } else if (dataHash) {
        // Datum hash
        datum = {
          inline: false,
          hash: dataHash.to_hex()
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
          switch (certType) {
            case 0: // StakeRegistration
              type = "StakeRegistration";
              details = {
                stakeCredential: cert.as_stake_registration()?.stake_credential().to_hex() || "",
                coin: cert.as_stake_registration()?.coin()?.to_str() || "0"
              };
              break;
            case 1: // StakeDeregistration
              type = "StakeDeregistration";
              details = {
                stakeCredential: cert.as_stake_deregistration()?.stake_credential().to_hex() || "",
                coin: cert.as_stake_deregistration()?.coin()?.to_str() || "0"
              };
              break;
            case 2: // StakeDelegation
              type = "StakeDelegation";
              details = {
                stakeCredential: cert.as_stake_delegation()?.stake_credential().to_hex() || "",
                poolKeyHash: cert.as_stake_delegation()?.pool_keyhash().to_hex() || ""
              };
              break;
            case 3: // PoolRegistration
              type = "PoolRegistration";
              const poolParams = cert.as_pool_registration()?.pool_params();
              if (poolParams) {
                details = {
                  operator: poolParams.operator().to_hex(),
                  vrfKeyHash: poolParams.vrf_keyhash().to_hex(),
                  pledge: poolParams.pledge().to_str(),
                  cost: poolParams.cost().to_str(),
                  margin: poolParams.margin().to_js_value(),
                  rewardAccount: poolParams.reward_account().to_address().to_bech32(),
                  poolOwners: Array.from({ length: poolParams.pool_owners().len() }, (_, i) => 
                    poolParams.pool_owners().get(i).to_hex()
                  ),
                  relays: Array.from({ length: poolParams.relays().len() }, (_, i) => 
                    poolParams.relays().get(i).to_js_value()
                  )
                };
              }
              break;
            case 4: // PoolRetirement
              type = "PoolRetirement";
              details = {
                poolKeyHash: cert.as_pool_retirement()?.pool_keyhash().to_hex() || "",
                epoch: cert.as_pool_retirement()?.epoch()
              };
              break;
            case 5: // GenesisKeyDelegation
              type = "GenesisKeyDelegation";
              details = {
                genesisHash: cert.as_genesis_key_delegation()?.genesishash().to_hex() || "",
                genesisDelegateHash: cert.as_genesis_key_delegation()?.genesis_delegate_hash().to_hex() || "",
                vrfKeyHash: cert.as_genesis_key_delegation()?.vrf_keyhash().to_hex() || ""
              };
              break;
            case 6: // MoveInstantaneousRewardsCert
              type = "MoveInstantaneousRewards";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 7: // CommitteeHotAuth
              type = "CommitteeHotAuth";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 8: // CommitteeColdResign
              type = "CommitteeColdResign";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 9: // DRepDeregistration
              type = "DRepDeregistration";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 10: // DRepRegistration
              type = "DRepRegistration";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 11: // DRepUpdate
              type = "DRepUpdate";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 12: // StakeAndVoteDelegation
              type = "StakeAndVoteDelegation";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 13: // StakeRegistrationAndDelegation
              type = "StakeRegistrationAndDelegation";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 14: // StakeVoteRegistrationAndDelegation
              type = "StakeVoteRegistrationAndDelegation";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 15: // VoteDelegation
              type = "VoteDelegation";
              details = {
                raw: cert.to_hex()
              };
              break;
            case 16: // VoteRegistrationAndDelegation
              type = "VoteRegistrationAndDelegation";
              details = {
                raw: cert.to_hex()
              };
              break;
            default:
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
            console.log('Voting procedures structure:', JSON.stringify(procedures, null, 2));
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
            console.log('Voting proposals structure:', JSON.stringify(proposals, null, 2));
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
                            hash: Array.from(constitutionBytes).map(b => b.toString(16).padStart(2, '0')).join(''),
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
    
    // Parse metadata
    const metadata = [];
    if (auxiliaryData) {
      const metadataMap = auxiliaryData.metadata();
      if (metadataMap) {
        const keys = metadataMap.keys();
        for (let i = 0; i < keys.len(); i++) {
          const label = keys.get(i).to_str();
          const metadatum = metadataMap.get(keys.get(i));
          
          if (metadatum) {
            // Try to parse as JSON based on metadatum type
            let jsonData = undefined;
            try {
              const kind = metadatum.kind();
              if (kind === 0) { // Text
                jsonData = metadatum.as_text();
              } else if (kind === 1) { // Int
                jsonData = metadatum.as_int().to_str();
              } else if (kind === 2) { // Bytes
                jsonData = Array.from(metadatum.as_bytes()).map(b => b.toString(16).padStart(2, '0')).join('');
              } else if (kind === 3) { // List
                jsonData = "List"; // Simplified for now
              } else if (kind === 4) { // Map
                jsonData = "Map"; // Simplified for now
              }
            } catch {
              // If parsing fails, store as raw
            }
            
      metadata.push({
              label,
              json: jsonData,
              cbor: metadatum.to_hex()
            });
          }
        }
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
          }
        });
      }
    }
    
    // Count witnesses
    const vkeyCount = witnessSet.vkeys()?.len() || 0;
    const nativeCount = witnessSet.native_scripts()?.len() || 0;
    const plutusCount = witnessSet.plutus_scripts()?.len() || 0;
    
    // Generate warnings
    const warnings = [];
    if (size > 16384) {
      warnings.push("Transaction size exceeds recommended limit");
    }
    if (inputs.length === 0) {
      warnings.push("No inputs found in transaction");
    }
    if (outputs.length === 0) {
      warnings.push("No outputs found in transaction");
    }
    
    // Clean up CSL objects
    transaction.free();
    body.free();
    witnessSet.free();
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
        warnings,
      },
    };
  } catch (error) {
    console.error('Transaction parsing error:', error);
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
