// Copyright 2023 Specter Ops, Inc.
//
// Licensed under the Apache License, Version 2.0
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//
// SPDX-License-Identifier: Apache-2.0

import { Box, Divider, Typography, useTheme } from '@mui/material';
import {
    EdgeCompositionRelationships,
    EdgeInfoComponents,
    EdgeInfoProps,
    EdgeInfoState,
    EdgeSections,
    SelectedEdge,
    apiClient,
    edgeSectionToggle,
    searchbarActions,
    transformToFlatGraphResponse,
    useExploreParams,
    useFeatureFlag,
    useFetchEntityProperties,
} from 'bh-shared-ui';
import isEmpty from 'lodash/isEmpty';
import { Dispatch, FC, Fragment } from 'react';
import { putGraphData, putGraphError, saveResponseForExport, setGraphLoading } from 'src/ducks/explore/actions';
import { addSnackbar } from 'src/ducks/global/actions';
import { useAppDispatch, useAppSelector } from 'src/store';
import EdgeInfoCollapsibleSection from 'src/views/Explore/EdgeInfo/EdgeInfoCollapsibleSection';
import EdgeObjectInformation from 'src/views/Explore/EdgeInfo/EdgeObjectInformation';

const getOnChange = async (
    dispatch: Dispatch<any>,
    sourceNodeId: number,
    targetNodeId: number,
    selectedEdgeName: string
) => {
    dispatch(setGraphLoading(true));
    await apiClient
        .getEdgeComposition(sourceNodeId, targetNodeId, selectedEdgeName)
        .then((result) => {
            if (isEmpty(result.data.data.nodes)) {
                throw new Error('empty result set');
            }
            const formattedData = transformToFlatGraphResponse(result.data);

            dispatch(saveResponseForExport(formattedData));
            dispatch(putGraphData(formattedData));
        })
        .catch((err) => {
            if (err?.code === 'ERR_CANCELED') {
                return;
            }
            dispatch(putGraphError(err));
            dispatch(addSnackbar('Query failed. Please try again.', 'edgeCompositionGraphQuery', {}));
        })
        .finally(() => {
            dispatch(setGraphLoading(false));
        });
};

const EdgeInfoContent: FC<{ selectedEdge: NonNullable<SelectedEdge> }> = ({ selectedEdge }) => {
    const theme = useTheme();
    const dispatch = useAppDispatch();
    const { data: backButtonFlag } = useFeatureFlag('back_button_support');
    const { setExploreParams, selectedItem, expandedPanelSections } = useExploreParams();
    const sections = EdgeInfoComponents[selectedEdge.name as keyof typeof EdgeInfoComponents];
    const { sourceNode, targetNode } = selectedEdge;
    const { objectId, type } = targetNode;
    const { entityProperties: targetNodeProperties } = useFetchEntityProperties({ objectId, nodeType: type });
    const edgeInfoState: EdgeInfoState = useAppSelector((state) => state.edgeinfo);

    return (
        <Box>
            <EdgeObjectInformation selectedEdge={selectedEdge} />
            {sections ? (
                <>
                    {Object.entries(sections).map((section, index) => {
                        const Section = section[1];
                        const sectionKeyLabel = section[0] as keyof typeof EdgeSections;
                        const expandedSections = edgeInfoState.expandedSections;
                        const isExpandedSection = expandedSections[sectionKeyLabel];

                        const sendOnChange =
                            EdgeCompositionRelationships.includes(selectedEdge.name) && section[0] === 'composition';

                        const isExpandedPanelSection = backButtonFlag?.enabled
                            ? (expandedPanelSections as string[]).includes(sectionKeyLabel)
                            : isExpandedSection;

                        const setExpandedPanelSectionsParam = () => {
                            setExploreParams({
                                expandedPanelSections: [sectionKeyLabel],
                                ...(sectionKeyLabel === 'composition' && {
                                    searchType: 'composition',
                                    relationshipQueryItemId: selectedItem,
                                }),
                            });
                        };

                        const removeExpandedPanelSectionParams = () => {
                            setExploreParams({
                                expandedPanelSections: [],
                            });
                        };

                        const handleOnChange = (isOpen: boolean) => {
                            if (backButtonFlag?.enabled) {
                                if (isOpen) setExpandedPanelSectionsParam();
                                else removeExpandedPanelSectionParams();
                            } else {
                                if (isOpen && sendOnChange) {
                                    getOnChange(
                                        dispatch,
                                        parseInt(`${sourceNode.id}`),
                                        parseInt(`${targetNode.id}`),
                                        selectedEdge.name
                                    );
                                }
                                dispatch(
                                    edgeSectionToggle({
                                        section: sectionKeyLabel,
                                        expanded: !isExpandedSection,
                                    })
                                );
                            }
                        };

                        const handleRelayTargetsItemClick: EdgeInfoProps['onNodeClick'] = (node) => {
                            dispatch(
                                searchbarActions.sourceNodeSelected({
                                    objectid: node.objectId,
                                    type: node.kind,
                                    name: node.name,
                                })
                            );

                            dispatch(searchbarActions.tabChanged('primary'));
                        };

                        return (
                            <Fragment key={index}>
                                <Box padding={1}>
                                    <Divider />
                                </Box>
                                <EdgeInfoCollapsibleSection
                                    label={EdgeSections[sectionKeyLabel]}
                                    isExpanded={isExpandedPanelSection}
                                    onChange={handleOnChange}>
                                    <Section
                                        edgeName={selectedEdge.name}
                                        sourceDBId={sourceNode.id}
                                        sourceName={sourceNode.name}
                                        sourceType={sourceNode.type}
                                        targetDBId={targetNode.id}
                                        targetName={targetNode.name}
                                        targetType={targetNode.type}
                                        targetId={targetNode.objectId}
                                        haslaps={!!targetNodeProperties?.haslaps}
                                        onNodeClick={
                                            section[0] === 'relaytargets' || section[0] === 'coerciontargets'
                                                ? handleRelayTargetsItemClick
                                                : undefined
                                        }
                                    />
                                </EdgeInfoCollapsibleSection>
                            </Fragment>
                        );
                    })}
                </>
            ) : (
                <>
                    <Box padding={1}>
                        <Divider />
                    </Box>
                    <Box paddingLeft={theme.spacing(1)}>
                        <Typography variant='body1' fontSize={'0.75rem'}>
                            The edge{' '}
                            <Typography component={'span'} variant='body1' fontWeight={'bold'} fontSize={'0.75rem'}>
                                {selectedEdge.name}
                            </Typography>{' '}
                            does not have any additional contextual information at this time.
                        </Typography>
                    </Box>
                </>
            )}
        </Box>
    );
};

export default EdgeInfoContent;
