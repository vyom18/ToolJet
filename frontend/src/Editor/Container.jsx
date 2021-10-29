import React, { useCallback, useState, useEffect } from 'react';
import { useDrop, useDragLayer } from 'react-dnd';
import { ItemTypes } from './ItemTypes';
import { DraggableBox } from './DraggableBox';
import { snapToGrid as doSnapToGrid } from './snapToGrid';
import update from 'immutability-helper';
import { componentTypes } from './Components/components';
import { computeComponentName } from '@/_helpers/utils';

function uuidv4() {
  return ([1e7] + -1e3 + -4e3 + -8e3 + -1e11).replace(/[018]/g, (c) =>
    (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)
  );
}

export const Container = ({
  canvasWidth,
  mode,
  snapToGrid,
  onComponentClick,
  onEvent,
  appDefinition,
  appDefinitionChanged,
  currentState,
  onComponentOptionChanged,
  onComponentOptionsChanged,
  appLoading,
  configHandleClicked,
  zoomLevel,
  currentLayout,
  removeComponent,
  deviceWindowWidth,
  selectedComponent,
  darkMode,
}) => {
  const styles = {
    width: currentLayout === 'mobile' ? deviceWindowWidth : '100%',
    height: 2400,
    position: 'absolute',
    backgroundSize: `${canvasWidth / 43}px 10px`,
  };

  const components = appDefinition.components;

  const [boxes, setBoxes] = useState(components);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setBoxes(components);
  }, [components]);

  const moveBox = useCallback(
    (id, layouts) => {
      setBoxes(
        update(boxes, {
          [id]: {
            $merge: { layouts },
          },
        })
      );
      console.log('new boxes - 1', boxes);
    },
    [boxes]
  );

  useEffect(() => {
    console.log('new boxes - 2', boxes);
    appDefinitionChanged({ ...appDefinition, components: boxes });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boxes]);

  const { draggingState } = useDragLayer((monitor) => {
    if (monitor.isDragging()) {
      if (!monitor.getItem().parent) {
        return { draggingState: true };
      } else {
        return { draggingState: false };
      }
    } else {
      return { draggingState: false };
    }
  });

  function convertXToPercentage(x, canvasWidth) {
    return (x * 100) / canvasWidth;
  }

  function convertXFromPercentage(x, canvasWidth) {
    return (x * canvasWidth) / 100;
  }

  useEffect(() => {
    setIsDragging(draggingState);
  }, [draggingState]);

  const [, drop] = useDrop(
    () => ({
      accept: ItemTypes.BOX,
      drop(item, monitor) {
        if (item.parent) {
          return;
        }

        let componentData = {};
        let componentMeta = {};
        let id = item.id;

        let left = 0;
        let top = 0;

        const canvasBoundingRect = document.getElementsByClassName('real-canvas')[0].getBoundingClientRect();

        //  This is a new component
        componentMeta = componentTypes.find((component) => component.component === item.component.component);
        console.log('adding new component');
        componentData = JSON.parse(JSON.stringify(componentMeta));
        componentData.name = computeComponentName(componentData.component, boxes);

        const offsetFromTopOfWindow = canvasBoundingRect.top;
        const offsetFromLeftOfWindow = canvasBoundingRect.left;
        const currentOffset = monitor.getSourceClientOffset();

        left = Math.round(currentOffset.x + currentOffset.x * (1 - zoomLevel) - offsetFromLeftOfWindow);
        top = Math.round(currentOffset.y + currentOffset.y * (1 - zoomLevel) - offsetFromTopOfWindow);

        id = uuidv4();

        const bundingRect = document.getElementsByClassName('canvas-area')[0].getBoundingClientRect();
        const canvasWidth = bundingRect?.width;

        if (snapToGrid) {
          [left, top] = doSnapToGrid(canvasWidth, left, top);
        }

        left = (left * 100) / canvasWidth;

        if (item.currentLayout === 'mobile') {
          componentData.definition.others.showOnDesktop.value = false;
          componentData.definition.others.showOnMobile.value = true;
        }

        const width = componentMeta.defaultSize.width;

        setBoxes({
          ...boxes,
          [id]: {
            component: componentData,
            layouts: {
              [item.currentLayout]: {
                top,
                left,
                width,
                height: componentMeta.defaultSize.height,
              },
            },
          },
        });

        return undefined;
      },
    }),
    [moveBox]
  );

  function onDragStop(e, componentId, direction, currentLayout) {
    const id = componentId ? componentId : uuidv4();

    // Get the width of the canvas
    const canvasBounds = document.getElementsByClassName('real-canvas')[0].getBoundingClientRect();
    const canvasWidth = canvasBounds?.width;
    const nodeBounds = direction.node.getBoundingClientRect();

    // Computing the left offset
    const leftOffset = nodeBounds.x - canvasBounds.x;
    const left = convertXToPercentage(leftOffset, canvasWidth);

    // Computing the top offset
    const top = nodeBounds.y - canvasBounds.y;

    let newBoxes = {
      ...boxes,
      [id]: {
        ...boxes[id],
        layouts: {
          ...boxes[id]['layouts'],
          [currentLayout]: {
            ...boxes[id]['layouts'][currentLayout],
            top: top,
            left: left,
          },
        },
      },
    };

    setBoxes(newBoxes);
  }

  function onResizeStop(id, e, direction, ref, d, position) {
    const deltaWidth = d.width;
    const deltaHeight = d.height;

    let { x, y } = position;

    const defaultData = {
      top: 100,
      left: 0,
      width: 445,
      height: 500,
    };

    let { left, top, width, height } = boxes[id]['layouts'][currentLayout] || defaultData;

    const boundingRect = document.getElementsByClassName('canvas-area')[0].getBoundingClientRect();
    const canvasWidth = boundingRect?.width;

    width = Math.round(width + (deltaWidth * 43) / canvasWidth); // convert the width delta to percentage
    height = height + deltaHeight;

    top = y;
    left = (x * 100) / canvasWidth;

    let newBoxes = {
      ...boxes,
      [id]: {
        ...boxes[id],
        layouts: {
          ...boxes[id]['layouts'],
          [currentLayout]: {
            ...boxes[id]['layouts'][currentLayout],
            width,
            height,
            top,
            left,
          },
        },
      },
    };

    setBoxes(newBoxes);
  }

  function paramUpdated(id, param, value) {
    if (Object.keys(value).length > 0) {
      setBoxes(
        update(boxes, {
          [id]: {
            $merge: {
              component: {
                ...boxes[id].component,
                definition: {
                  ...boxes[id].component.definition,
                  properties: {
                    ...boxes[id].component.definition.properties,
                    [param]: value,
                  },
                },
              },
            },
          },
        })
      );
    }
  }


  return (
    <div ref={drop} style={styles} className={`real-canvas ${isDragging || isResizing ? 'show-grid' : ''}`}>
      {Object.keys(boxes).map((key) => {
        const box = boxes[key];
        const canShowInCurrentLayout =
          box.component.definition.others[currentLayout === 'mobile' ? 'showOnMobile' : 'showOnDesktop'].value;

        if (!box.parent && canShowInCurrentLayout) {
          return (
            <DraggableBox
              canvasWidth={canvasWidth}
              onComponentClick={onComponentClick}
              onEvent={onEvent}
              onComponentOptionChanged={onComponentOptionChanged}
              onComponentOptionsChanged={onComponentOptionsChanged}
              key={key}
              currentState={currentState}
              onResizeStop={onResizeStop}
              onDragStop={onDragStop}
              paramUpdated={paramUpdated}
              id={key}
              {...boxes[key]}
              mode={mode}
              resizingStatusChanged={(status) => setIsResizing(status)}
              draggingStatusChanged={(status) => setIsDragging(status)}
              inCanvas={true}
              zoomLevel={zoomLevel}
              configHandleClicked={configHandleClicked}
              removeComponent={removeComponent}
              currentLayout={currentLayout}
              deviceWindowWidth={deviceWindowWidth}
              isSelectedComponent={selectedComponent ? selectedComponent.id === key : false}
              darkMode={darkMode}
              containerProps={{
                mode,
                snapToGrid,
                onComponentClick,
                onEvent,
                appDefinition,
                appDefinitionChanged,
                currentState,
                onComponentOptionChanged,
                onComponentOptionsChanged,
                appLoading,
                zoomLevel,
                configHandleClicked,
                removeComponent,
                currentLayout,
                deviceWindowWidth,
                selectedComponent,
                darkMode,
              }}
            />
          );
        }
      })}
      {Object.keys(boxes).length === 0 && !appLoading && !isDragging && (
        <div className="mx-auto w-50 p-5 bg-light no-components-box" style={{ marginTop: '10%' }}>
          <center className="text-muted">
            You haven&apos;t added any components yet. Drag components from the right sidebar and drop here. Check out
            our{' '}
            <a href="https://docs.tooljet.io/docs/tutorial/adding-widget" target="_blank" rel="noreferrer">
              guide
            </a>{' '}
            on adding widgets.
          </center>
        </div>
      )}
      {appLoading && (
        <div className="mx-auto mt-5 w-50 p-5">
          <center>
            <div className="spinner-border text-azure" role="status"></div>
          </center>
        </div>
      )}
    </div>
  );
};
